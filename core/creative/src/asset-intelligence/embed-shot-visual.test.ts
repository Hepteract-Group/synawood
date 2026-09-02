import { describe, expect, it, vi } from 'vitest'
import { ASSET_TEXT_EMBEDDING_MODEL_ID, mockTextEmbedding } from './embed'
import { embedShotVisualForIndex, embedVisualQuery } from './embed-shot-visual'
import {
  ASSET_VISUAL_EMBEDDING_DIMS,
  CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
  mockVisualEmbedding,
} from '../model-profiles/embed-visual'

describe('embedShotVisualForIndex (#582)', () => {
  it('returns a mock visual vector of the pinned dim, not a caption text embed', async () => {
    const captionVector = mockTextEmbedding('A product close-up')
    const result = await embedShotVisualForIndex({
      thumbBytes: Buffer.from('jpeg-keyframe-bytes!!'),
      seed: 'shot-aaa',
      useMock: true,
      modelId: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
    })
    expect(result.skipped).toBe(false)
    if (result.skipped) throw new Error('expected visual embed')
    expect(result.modelId).toBe(CI_STUB_VISUAL_EMBEDDING_MODEL_ID)
    expect(result.embedding).toHaveLength(ASSET_VISUAL_EMBEDDING_DIMS)
    expect(result.embedding).toEqual(mockVisualEmbedding('shot-aaa'))
    expect(result.embedding).not.toEqual(captionVector)
    expect(result.modelId).not.toBe(ASSET_TEXT_EMBEDDING_MODEL_ID)
  })

  it('skips when the keyframe is empty', async () => {
    const result = await embedShotVisualForIndex({
      thumbBytes: new Uint8Array(0),
      seed: 'shot-aaa',
      useMock: true,
      modelId: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
    })
    expect(result.skipped).toBe(true)
    if (!result.skipped) throw new Error('expected skip')
    expect(result.reason).toMatch(/keyframe|empty|thumb/i)
  })

  it('does not call the SDK on the mock path', async () => {
    const embed = vi.fn()
    await embedShotVisualForIndex(
      {
        thumbBytes: Buffer.from('jpeg-keyframe-bytes!!'),
        seed: 'shot-bbb',
        useMock: true,
        modelId: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      },
      { embed: embed as never },
    )
    expect(embed).not.toHaveBeenCalled()
  })

  it('sends the keyframe bytes to the embed API, not the shot id', async () => {
    const jpeg = Buffer.from('jpeg-keyframe-bytes!!')
    const embedding = mockVisualEmbedding('live')
    const embed = vi.fn(async () => ({ embedding }))
    const result = await embedShotVisualForIndex(
      {
        thumbBytes: jpeg,
        seed: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000000',
        useMock: false,
        modelId: 'google/gemini-embedding-2',
      },
      { embed: embed as never },
    )
    expect(result.skipped).toBe(false)
    expect(embed).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'shot keyframe',
        providerOptions: expect.objectContaining({
          google: expect.objectContaining({
            content: [
              [
                expect.objectContaining({
                  inlineData: expect.objectContaining({
                    data: jpeg.toString('base64'),
                    mimeType: 'image/jpeg',
                  }),
                }),
              ],
            ],
          }),
        }),
      }),
    )
  })
})

describe('embedVisualQuery (#583)', () => {
  it('embeds the query text in visual space on the mock path', async () => {
    const result = await embedVisualQuery({
      query: 'product close-up',
      useMock: true,
      modelId: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
    })
    expect(result.skipped).toBe(false)
    if (result.skipped) throw new Error('expected visual query embed')
    expect(result.embedding).toEqual(mockVisualEmbedding('product close-up'))
    expect(result.embedding).not.toEqual(mockTextEmbedding('product close-up'))
  })

  it('sends the query string, not an image, to the live embed API', async () => {
    const embedding = mockVisualEmbedding('live-query')
    const embed = vi.fn(async () => ({ embedding }))
    const result = await embedVisualQuery(
      { query: 'red UI on a laptop', useMock: false, modelId: 'google/gemini-embedding-2' },
      { embed: embed as never },
    )
    expect(result.skipped).toBe(false)
    expect(embed).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'red UI on a laptop',
        providerOptions: expect.objectContaining({
          google: expect.objectContaining({ outputDimensionality: ASSET_VISUAL_EMBEDDING_DIMS }),
        }),
      }),
    )
  })
})
