/** Wave 2I / #516 — stub vs live video clip adapter (ADR-0048). #1068/#1069 family routing. */

import { experimental_generateVideo } from 'ai'
import { toBrandPromptBlock } from '../brand/prompt-context'
import { withWanCharacterTokens } from '../model-profiles/video-families/wan3'
import { resolveVideoModelFamily } from '../model-profiles/video-families'
import { canonicalizeVideoModelId } from '../model-profiles/video-models'
import { assertGeneratedAssetQc } from './qc'
import type { AssetRef, GenerateVideoInput } from './types'

export const isStubVideoModelId = (modelId: string): boolean =>
  modelId.startsWith('mock') || modelId.startsWith('placeholder/') || modelId === 'disabled'

export type GatewayVideoReference = {
  bytes: Uint8Array
  mediaType: string
}

export type GatewayVideoClient = (input: {
  modelId: string
  prompt: string
  durationSeconds: number
  sourceImageBytes?: Uint8Array
  /** All stills including the first, for reference-to-video when length > 1. */
  referenceImages?: GatewayVideoReference[]
  /** Omit on first-frame i2v — Seedance locks ratio to the still. */
  aspectRatio?: `${number}:${number}`
}) => Promise<{ bytes: Uint8Array; contentType: string; durationSeconds: number }>

const requireGatewayKey = (): void => {
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    throw new Error(
      'AI_GATEWAY_API_KEY is required for live video models. Switch to Tests (ci-stub) for mock clips, or set the key in .env.local.',
    )
  }
}

/** First-frame i2v and multi-ref inherit the still's ratio (Seedance). Text-to-video stays 9:16. */
export const resolveVideoAspectRatio = (
  sourceImageBytes?: Uint8Array,
  referenceImages?: GatewayVideoReference[],
): `${number}:${number}` | undefined => {
  const hasStill =
    Boolean(sourceImageBytes && sourceImageBytes.byteLength > 0) ||
    Boolean(referenceImages?.some((row) => row.bytes.byteLength > 0))
  return hasStill ? undefined : '9:16'
}

export const withReferenceImageTags = (
  prompt: string,
  stillCount: number,
  videoCount = 0,
  continuing = false,
): string => {
  const bits: string[] = []
  if (stillCount >= 2 || videoCount > 0) {
    if (stillCount >= 1) {
      const tags = Array.from({ length: stillCount }, (_, i) => `[Image ${i + 1}]`).join(', ')
      if (stillCount >= 2) {
        bits.push(
          `Use ${tags} as product stills in that order. [Image 1] opens the clip. Every later [Image n] is a different garment/look that must appear in this clip (cut, second model, or wardrobe change). Do not keep a single silhouette from [Image 1] only.`,
        )
      } else {
        bits.push(
          `Use ${tags} as product stills in that order. [Image 1] is the first frame and identity.`,
        )
      }
    }
    if (videoCount >= 1) {
      const tags = Array.from({ length: videoCount }, (_, i) => `[Video ${i + 1}]`).join(', ')
      bits.push(
        continuing
          ? `${tags} is the previous shot of this ad. Continue that action in this clip; same people and wardrobe; do not start a new scene.`
          : `Also use ${tags} as motion/scene references. Keep garments from the stills recognisable.`,
      )
    }
  }
  if (bits.length === 0) return prompt
  return `${bits.join(' ')} Keep every referenced garment, product, and prop recognisable — do not invent extra looks. ${prompt}`
}

/** Family-aware ref tokens — Wan uses character1; Seedance uses [Image n]; Veo and MiniMax H3 leave the prompt. */
export const withVideoReferenceTags = (
  modelId: string,
  prompt: string,
  stillCount: number,
  videoCount = 0,
  continuing = false,
): string => {
  const family = resolveVideoModelFamily(modelId)
  if (family === 'wan3') {
    return withWanCharacterTokens(prompt, stillCount, videoCount, continuing)
  }
  // Veo and MiniMax H3 have no Seedance-style [Image n] tokens.
  if (family === 'minimax-h3' || family === 'veo') {
    return prompt
  }
  return withReferenceImageTags(prompt, stillCount, videoCount, continuing)
}

const defaultGatewayVideoClient: GatewayVideoClient = async ({
  modelId,
  prompt,
  durationSeconds,
  sourceImageBytes,
  referenceImages,
  aspectRatio,
}) => {
  requireGatewayKey()
  const refs = (referenceImages ?? []).filter((row) => row.bytes.byteLength > 0)
  const firstFrame =
    sourceImageBytes && sourceImageBytes.byteLength > 0 ? sourceImageBytes : undefined
  const promptArg = firstFrame && refs.length === 0 ? { image: firstFrame, text: prompt } : prompt
  const result = await experimental_generateVideo({
    model: modelId,
    prompt: promptArg,
    duration: durationSeconds,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(refs.length > 0
      ? {
          inputReferences: refs.map((row) => ({
            data: row.bytes,
            mediaType: row.mediaType,
          })),
        }
      : {}),
  })
  const file = result.video
  const bytes = file.uint8Array
  const contentType = file.mediaType?.startsWith('video/') ? file.mediaType : 'video/mp4'
  return { bytes, contentType, durationSeconds }
}

const stubVideo = (input: GenerateVideoInput): AssetRef => {
  const marker = `SYNAWOOD_MOCK_VIDEO\nmodel=${input.modelId}\nseconds=${input.durationSeconds}\nprompt=${input.prompt.slice(0, 120)}\nsource=${input.sourceImageAssetId ?? 'none'}\nrefs=${(input.referenceImageAssetIds ?? []).join(',')}\nvrefs=${(input.referenceVideoAssetIds ?? []).join(',')}\n`
  return {
    kind: 'video',
    bytes: new TextEncoder().encode(marker),
    contentType: 'video/mp4',
    probe: {
      durationSeconds: input.durationSeconds,
      durationFrames: Math.round(input.durationSeconds * 30),
      modelId: input.modelId,
      sourceImageAssetId: input.sourceImageAssetId,
      referenceImageAssetIds: input.referenceImageAssetIds,
      referenceVideoAssetIds: input.referenceVideoAssetIds,
      prompt: input.prompt,
      stub: true,
    },
    brandRefsUnsupported: !input.sourceImageAssetId,
  }
}

export const generateVideoClip = async (
  input: GenerateVideoInput,
  deps?: { gateway?: GatewayVideoClient },
): Promise<AssetRef> => {
  if (input.durationSeconds <= 0) {
    throw new Error('Video duration must be positive')
  }
  const modelId = canonicalizeVideoModelId(input.modelId)
  const cap = input.maxVideoSeconds
  if (cap != null && cap > 0 && input.durationSeconds > cap) {
    throw new Error(
      `Video duration ${input.durationSeconds}s exceeds profile max ${cap}s. Shorten the clip or raise maxVideoSeconds.`,
    )
  }

  if (isStubVideoModelId(modelId)) {
    const stub = stubVideo({ ...input, modelId })
    assertGeneratedAssetQc(stub)
    return stub
  }

  const brandBlock = toBrandPromptBlock(input.brand)
  const prompt = `${input.prompt.trim()}\n\n${brandBlock}`
  const client = deps?.gateway ?? defaultGatewayVideoClient
  const referenceImages = (input.referenceImages ?? []).filter((row) => row.bytes.byteLength > 0)
  const out = await client({
    modelId,
    prompt,
    durationSeconds: input.durationSeconds,
    sourceImageBytes: input.sourceImageBytes,
    referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    aspectRatio: resolveVideoAspectRatio(input.sourceImageBytes, referenceImages),
  })

  if (!out.bytes?.byteLength) {
    throw new Error(`Video model ${modelId} returned no usable MP4. Retry or switch profile.`)
  }

  const durationSeconds = out.durationSeconds > 0 ? out.durationSeconds : input.durationSeconds
  if (cap != null && cap > 0 && durationSeconds > cap) {
    throw new Error(
      `Generated video duration ${durationSeconds}s exceeds profile max ${cap}s. Refusing to attach.`,
    )
  }

  const asset: AssetRef = {
    kind: 'video',
    bytes: out.bytes,
    contentType: out.contentType.startsWith('video/') ? out.contentType : 'video/mp4',
    probe: {
      durationSeconds,
      durationFrames: Math.round(durationSeconds * 30),
      modelId,
      sourceImageAssetId: input.sourceImageAssetId,
      referenceImageAssetIds: input.referenceImageAssetIds,
      referenceVideoAssetIds: input.referenceVideoAssetIds,
      prompt: input.prompt,
      gateway: true,
      i2v: Boolean(input.sourceImageBytes) || referenceImages.length > 0,
    },
    brandRefsUnsupported: !input.sourceImageBytes && referenceImages.length === 0,
  }
  assertGeneratedAssetQc(asset)
  return asset
}
