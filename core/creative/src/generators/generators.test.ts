import { describe, expect, it } from 'vitest'
import { generateImage, generateSpeech, generateVideoClip, transcribeMedia } from './index'
import {
  resolveVideoAspectRatio,
  withReferenceImageTags,
  withVideoReferenceTags,
} from './video-clip'
import { WAN3_VIDEO_MODEL_ID } from '../model-profiles/video-families/wan3'
import type { BrandPromptContext } from '../brand/prompt-context'

const brand: BrandPromptContext = {
  productId: 'demo',
  displayName: 'the private example',
  mood: 'calm',
  paletteHex: ['#1F6B4A'],
  promptTokens: ['calm workspace'],
  forbiddenClaims: [],
  doNotes: [],
  dontNotes: [],
  voiceId: 'mock-demo-en',
  speakingNotes: '',
  defaultCta: 'example.com',
  neverFakeProductChrome: true,
}

describe('mock generators', () => {
  it('returns deterministic image/speech/video/transcript assets', async () => {
    const image = await generateImage({
      prompt: 'calm workspace',
      brand,
      referenceAssetIds: [],
      aspectRatio: '9:16',
      modelId: 'mock-image',
    })
    expect(image.kind).toBe('image')
    expect(image.contentType).toContain('svg')

    const speech = await generateSpeech({
      text: 'Edit PDFs without Adobe',
      brand,
      modelId: 'mock-speech',
    })
    expect(speech.kind).toBe('audio')

    const video = await generateVideoClip({
      prompt: 'from still',
      brand,
      sourceImageAssetId: '11111111-1111-4111-8111-111111111111',
      durationSeconds: 4,
      modelId: 'mock-video',
    })
    expect(video.kind).toBe('video')
    expect(video.probe.durationSeconds).toBe(4)
    expect(video.probe.stub).toBe(true)
    expect(video.probe.gateway).toBeUndefined()

    const transcript = await transcribeMedia({
      audioAssetId: '11111111-1111-4111-8111-111111111111',
      modelId: 'mock-transcribe',
      audioBytes: speech.bytes,
    })
    expect(transcript.text.length).toBeGreaterThan(0)
  })
})

describe('gateway image adapter', () => {
  it('calls Gateway client with brand prompt block and returns PNG', async () => {
    let seenPrompt = ''
    let seenModel = ''
    const image = await generateImage(
      {
        prompt: 'calm PDF desk',
        brand,
        referenceAssetIds: ['logo-1'],
        aspectRatio: '9:16',
        modelId: 'bytedance/seedream-5.0-lite',
      },
      {
        gateway: async ({ modelId, prompt }) => {
          seenModel = modelId
          seenPrompt = prompt
          return { bytes: new Uint8Array([1, 2, 3, 4]), contentType: 'image/png' }
        },
      },
    )
    expect(seenModel).toBe('bytedance/seedream-5.0-lite')
    expect(seenPrompt).toContain('calm PDF desk')
    expect(seenPrompt).toContain('Brand: the private example')
    expect(image.contentType).toBe('image/png')
    expect(image.bytes.length).toBe(4)
    expect(image.probe.gateway).toBe(true)
  })

  it('rewrites xai/grok-imagine-image to spacexai before Gateway (#1005)', async () => {
    let seenModel = ''
    await generateImage(
      {
        prompt: 'desk',
        brand,
        referenceAssetIds: [],
        aspectRatio: '9:16',
        modelId: 'xai/grok-imagine-image',
      },
      {
        gateway: async ({ modelId }) => {
          seenModel = modelId
          return { bytes: new Uint8Array([1, 2, 3, 4]), contentType: 'image/png' }
        },
      },
    )
    expect(seenModel).toBe('spacexai/grok-imagine-image')
  })

  it('does not call Gateway for a frozen leftover xai/ id (#1005)', async () => {
    let called = false
    await expect(
      generateImage(
        {
          prompt: 'desk',
          brand,
          referenceAssetIds: [],
          aspectRatio: '9:16',
          modelId: 'xai/not-a-real-model',
        },
        {
          gateway: async () => {
            called = true
            return { bytes: new Uint8Array([1]), contentType: 'image/png' }
          },
        },
      ),
    ).rejects.toThrow(/gone from Vercel/i)
    expect(called).toBe(false)
  })

  it('routes Gemini Nano Banana models through the injected client (multimodal path)', async () => {
    const image = await generateImage(
      {
        prompt: 'developer with the private example',
        brand,
        referenceAssetIds: [],
        aspectRatio: '9:16',
        modelId: 'google/gemini-3.1-flash-image',
      },
      {
        gateway: async ({ modelId }) => {
          expect(modelId).toBe('google/gemini-3.1-flash-image')
          return { bytes: new Uint8Array([9, 8, 7]), contentType: 'image/png' }
        },
      },
    )
    expect(image.probe.multimodal).toBe(true)
    expect(image.bytes.length).toBe(3)
  })

  it('rejects empty image bytes from the Gateway client (QC gate)', async () => {
    await expect(
      generateImage(
        {
          prompt: 'empty',
          brand,
          referenceAssetIds: [],
          aspectRatio: '9:16',
          modelId: 'bytedance/seedream-5.0-lite',
        },
        {
          gateway: async () => ({ bytes: new Uint8Array(), contentType: 'image/png' }),
        },
      ),
    ).rejects.toThrow(/empty/i)
  })

  it('fails closed without AI_GATEWAY_API_KEY when using default client', async () => {
    const prev = process.env.AI_GATEWAY_API_KEY
    delete process.env.AI_GATEWAY_API_KEY
    await expect(
      generateImage({
        prompt: 'x',
        brand,
        referenceAssetIds: [],
        aspectRatio: '9:16',
        modelId: 'bytedance/seedream-5.0-lite',
      }),
    ).rejects.toThrow(/AI_GATEWAY_API_KEY/)
    await expect(
      generateImage({
        prompt: 'x',
        brand,
        referenceAssetIds: [],
        aspectRatio: '9:16',
        modelId: 'google/gemini-3-pro-image',
      }),
    ).rejects.toThrow(/AI_GATEWAY_API_KEY/)
    if (prev !== undefined) process.env.AI_GATEWAY_API_KEY = prev
  })
})

describe('gateway video adapter (#516)', () => {
  it('calls the injected client with brand prompt and prefers i2v bytes', async () => {
    let seen: {
      modelId?: string
      prompt?: string
      durationSeconds?: number
      hasStill?: boolean
      aspectRatio?: `${number}:${number}`
    } = {}
    const video = await generateVideoClip(
      {
        prompt: 'walk a runway with flashing lights',
        brand,
        sourceImageAssetId: '11111111-1111-4111-8111-111111111111',
        sourceImageBytes: new Uint8Array([1, 2, 3]),
        durationSeconds: 4,
        modelId: 'google/veo-3.1-fast-generate-preview',
        maxVideoSeconds: 8,
      },
      {
        gateway: async ({ modelId, prompt, durationSeconds, sourceImageBytes, aspectRatio }) => {
          seen = {
            modelId,
            prompt,
            durationSeconds,
            hasStill: Boolean(sourceImageBytes?.byteLength),
            aspectRatio,
          }
          return { bytes: new Uint8Array([9, 8, 7, 6]), contentType: 'video/mp4', durationSeconds }
        },
      },
    )
    expect(seen.modelId).toBe('google/veo-3.1-fast-generate-001')
    expect(seen.prompt).toContain('walk a runway with flashing lights')
    expect(seen.prompt).toContain('Brand: the private example')
    expect(seen.hasStill).toBe(true)
    expect(seen.aspectRatio).toBeUndefined()
    expect(video.probe.gateway).toBe(true)
    expect(video.probe.i2v).toBe(true)
    expect(video.probe.stub).toBeUndefined()
    expect(video.bytes.length).toBe(4)
  })

  it('omits a fixed ratio on first-frame i2v and keeps 9:16 for text-to-video (#604)', async () => {
    expect(resolveVideoAspectRatio(new Uint8Array([1]))).toBeUndefined()
    expect(resolveVideoAspectRatio()).toBe('9:16')
    let seenRatio: `${number}:${number}` | undefined
    await generateVideoClip(
      {
        prompt: 'empty runway',
        brand,
        durationSeconds: 4,
        modelId: 'google/veo-3.1-fast-generate-001',
        maxVideoSeconds: 8,
      },
      {
        gateway: async ({ aspectRatio }) => {
          seenRatio = aspectRatio
          return {
            bytes: new Uint8Array([9, 8, 7, 6]),
            contentType: 'video/mp4',
            durationSeconds: 4,
          }
        },
      },
    )
    expect(seenRatio).toBe('9:16')
  })

  it('sends every still as a reference, not only the first frame (#603)', async () => {
    let seenRefCount = 0
    const video = await generateVideoClip(
      {
        prompt: withReferenceImageTags('two looks on a runway', 2),
        brand,
        sourceImageAssetId: '11111111-1111-4111-8111-111111111111',
        sourceImageBytes: new Uint8Array([1]),
        referenceImageAssetIds: ['22222222-2222-4222-8222-222222222222'],
        referenceImages: [
          { bytes: new Uint8Array([1]), mediaType: 'image/jpeg' },
          { bytes: new Uint8Array([2]), mediaType: 'image/png' },
        ],
        durationSeconds: 4,
        modelId: 'bytedance/seedance-2.0-fast',
        maxVideoSeconds: 15,
      },
      {
        gateway: async ({ referenceImages, aspectRatio }) => {
          seenRefCount = referenceImages?.length ?? 0
          expect(aspectRatio).toBeUndefined()
          return {
            bytes: new Uint8Array([9, 8, 7, 6]),
            contentType: 'video/mp4',
            durationSeconds: 4,
          }
        },
      },
    )
    expect(seenRefCount).toBe(2)
    expect(video.probe.i2v).toBe(true)
    expect(video.probe.referenceImageAssetIds).toEqual(['22222222-2222-4222-8222-222222222222'])
    expect(withReferenceImageTags('walk', 2)).toMatch(/\[Image 1\].*\[Image 2\]/)
    expect(withReferenceImageTags('walk', 2)).toMatch(/must appear/)
    expect(withReferenceImageTags('walk', 2)).not.toMatch(/same silhouette/)
  })

  it('sends tagged video bytes as a video/mp4 ref (#610)', async () => {
    let seenTypes: string[] = []
    const video = await generateVideoClip(
      {
        prompt: withReferenceImageTags('Manchester streets with this collection', 1, 1),
        brand,
        sourceImageAssetId: '11111111-1111-4111-8111-111111111111',
        sourceImageBytes: new Uint8Array([1]),
        referenceVideoAssetIds: ['44444444-4444-4444-8444-444444444444'],
        referenceImages: [
          { bytes: new Uint8Array([1]), mediaType: 'image/jpeg' },
          { bytes: new Uint8Array([9, 8, 7, 6]), mediaType: 'video/mp4' },
        ],
        durationSeconds: 4,
        modelId: 'bytedance/seedance-2.0-fast',
        maxVideoSeconds: 15,
      },
      {
        gateway: async ({ referenceImages, aspectRatio }) => {
          seenTypes = (referenceImages ?? []).map((row) => row.mediaType)
          expect(aspectRatio).toBeUndefined()
          return {
            bytes: new Uint8Array([9, 8, 7, 6]),
            contentType: 'video/mp4',
            durationSeconds: 4,
          }
        },
      },
    )
    expect(seenTypes).toEqual(['image/jpeg', 'video/mp4'])
    expect(video.probe.referenceVideoAssetIds).toEqual(['44444444-4444-4444-8444-444444444444'])
    expect(withReferenceImageTags('walk', 1, 1)).toMatch(/\[Image 1\].*\[Video 1\]/)
    expect(withReferenceImageTags('walk', 1, 1, true)).toMatch(/previous shot of this ad/)
  })

  it('Wan 3 fixture uses character tokens, not Seedance [Image n] (#1068/#1069)', async () => {
    let seenPrompt = ''
    await generateVideoClip(
      {
        prompt: withVideoReferenceTags(WAN3_VIDEO_MODEL_ID, 'two looks on a runway', 2, 0),
        brand,
        sourceImageAssetId: '11111111-1111-4111-8111-111111111111',
        sourceImageBytes: new Uint8Array([1]),
        referenceImageAssetIds: ['22222222-2222-4222-8222-222222222222'],
        referenceImages: [
          { bytes: new Uint8Array([1]), mediaType: 'image/jpeg' },
          { bytes: new Uint8Array([2]), mediaType: 'image/png' },
        ],
        durationSeconds: 10,
        modelId: WAN3_VIDEO_MODEL_ID,
        maxVideoSeconds: 30,
      },
      {
        gateway: async ({ prompt }) => {
          seenPrompt = prompt
          return {
            bytes: new Uint8Array([9, 8, 7, 6]),
            contentType: 'video/mp4',
            durationSeconds: 10,
          }
        },
      },
    )
    expect(seenPrompt).toMatch(/character1/)
    expect(seenPrompt).not.toMatch(/\[Image \d+\]/)
    expect(withVideoReferenceTags(WAN3_VIDEO_MODEL_ID, 'walk', 2)).not.toMatch(/\[Image \d+\]/)
    expect(withVideoReferenceTags('google/veo-3.1-fast-generate-001', 'walk', 2)).toBe('walk')
    expect(withVideoReferenceTags('bytedance/seedance-2.0-fast', 'walk', 2)).toMatch(/\[Image 2\]/)
    expect(withVideoReferenceTags('minimax/minimax-h3', 'walk', 3, 1)).toBe('walk')
    expect(withVideoReferenceTags('minimax/minimax-h3', 'walk', 3, 1)).not.toMatch(/\[Image \d+\]/)
  })

  it('does not swap in mock bytes when the live client fails', async () => {
    await expect(
      generateVideoClip(
        {
          prompt: 'boom',
          brand,
          durationSeconds: 4,
          modelId: 'google/veo-3.1-fast-generate-001',
        },
        {
          gateway: async () => {
            throw new Error('Gateway video 500')
          },
        },
      ),
    ).rejects.toThrow(/Gateway video 500/)
  })

  it('rejects clips longer than maxVideoSeconds', async () => {
    await expect(
      generateVideoClip({
        prompt: 'too long',
        brand,
        durationSeconds: 12,
        modelId: 'mock-video',
        maxVideoSeconds: 8,
      }),
    ).rejects.toThrow(/exceeds profile max 8s/)
  })

  it('fails closed without AI_GATEWAY_API_KEY on the default live client', async () => {
    const prev = process.env.AI_GATEWAY_API_KEY
    delete process.env.AI_GATEWAY_API_KEY
    await expect(
      generateVideoClip({
        prompt: 'x',
        brand,
        durationSeconds: 4,
        modelId: 'google/veo-3.1-fast-generate-preview',
      }),
    ).rejects.toThrow(/AI_GATEWAY_API_KEY/)
    if (prev !== undefined) process.env.AI_GATEWAY_API_KEY = prev
  })
})
