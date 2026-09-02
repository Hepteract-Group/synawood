import { generateImage as aiGenerateImage, generateText } from 'ai'
import { toBrandPromptBlock } from '../brand/prompt-context'
import {
  canonicalizeImageModelId,
  isFrozenImageModelId,
  isStubImageModelId,
} from '../model-profiles/image-models'
import { assertGeneratedAssetQc } from './qc'
import type { AssetRef, GenerateImageInput } from './types'

const svgForPrompt = (prompt: string, primary: string): string => {
  const safe = prompt.replace(/[<>&]/g, '').slice(0, 80)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="${primary}"/>
  <text x="80" y="960" font-family="system-ui,sans-serif" font-size="48" fill="#F7F5F0">${safe || 'mock image'}</text>
</svg>`
}

export type GatewayImageClient = (input: {
  modelId: string
  prompt: string
  aspectRatio: string
}) => Promise<{ bytes: Uint8Array; contentType: string }>

/**
 * Gemini Nano Banana family models are multimodal chat models on Gateway —
 * they reject `generateImage` with "is a language model, not an image model".
 * Call them via `generateText` and read `result.files` (AI Gateway docs).
 */
export const isMultimodalImageLlm = (modelId: string): boolean =>
  /^google\/gemini-.*image/i.test(modelId)

const parseAspectRatio = (raw: string): `${number}:${number}` | undefined => {
  const match = /^(\d+)\s*:\s*(\d+)$/.exec(raw.trim())
  if (!match) return undefined
  return `${Number(match[1])}:${Number(match[2])}`
}

const requireGatewayKey = (): void => {
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    throw new Error(
      'AI_GATEWAY_API_KEY is required for Gateway image models. Set it in .env.local / Vercel, or set Image to Off.',
    )
  }
}

const defaultImageOnlyClient: GatewayImageClient = async ({ modelId, prompt, aspectRatio }) => {
  requireGatewayKey()
  const result = await aiGenerateImage({
    model: modelId,
    prompt,
    aspectRatio: parseAspectRatio(aspectRatio),
  })
  const file = result.image
  const contentType = file.mediaType?.startsWith('image/') ? file.mediaType : 'image/png'
  return { bytes: file.uint8Array, contentType }
}

const defaultMultimodalClient: GatewayImageClient = async ({ modelId, prompt, aspectRatio }) => {
  requireGatewayKey()
  const result = await generateText({
    model: modelId,
    prompt: `${prompt}\n\nGenerate one image. Preferred aspect ratio: ${aspectRatio}.`,
    providerOptions: {
      google: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    },
  })
  const file = result.files?.find((item) => item.mediaType?.startsWith('image/'))
  if (!file?.uint8Array?.length) {
    throw new Error(
      `Multimodal image model ${modelId} returned no image files (text only). Try Seedream/Grok Imagine, or retry with a simpler prompt.`,
    )
  }
  const contentType = file.mediaType?.startsWith('image/') ? file.mediaType : 'image/png'
  return { bytes: file.uint8Array, contentType }
}

const stubImage = (input: GenerateImageInput): AssetRef => {
  const primary = input.brand.paletteHex[0] ?? '#1F6B4A'
  const svg = svgForPrompt(input.prompt, primary)
  return {
    kind: 'image',
    bytes: new TextEncoder().encode(svg),
    contentType: 'image/svg+xml',
    probe: {
      width: 1080,
      height: 1920,
      aspectRatio: input.aspectRatio,
      modelId: input.modelId,
      prompt: input.prompt,
      referenceAssetIds: input.referenceAssetIds,
    },
    brandRefsUnsupported: input.modelId.startsWith('placeholder/') && !input.modelId.includes('hi'),
  }
}

export const generateImage = async (
  input: GenerateImageInput,
  deps?: { gateway?: GatewayImageClient },
): Promise<AssetRef> => {
  const modelId = canonicalizeImageModelId(input.modelId)
  if (isFrozenImageModelId(input.modelId) || isFrozenImageModelId(modelId)) {
    throw new Error(
      'This image model is gone from Vercel — no spend. Pick another in Settings → Models.',
    )
  }
  if (isStubImageModelId(modelId)) {
    const stub = stubImage({ ...input, modelId })
    assertGeneratedAssetQc(stub)
    return stub
  }

  const brandBlock = toBrandPromptBlock(input.brand)
  const prompt = `${input.prompt.trim()}\n\n${brandBlock}`
  const client =
    deps?.gateway ??
    (isMultimodalImageLlm(modelId) ? defaultMultimodalClient : defaultImageOnlyClient)
  const out = await client({
    modelId,
    prompt,
    aspectRatio: input.aspectRatio,
  })

  const asset: AssetRef = {
    kind: 'image',
    bytes: out.bytes,
    contentType: out.contentType,
    probe: {
      aspectRatio: input.aspectRatio,
      modelId,
      prompt: input.prompt,
      referenceAssetIds: input.referenceAssetIds,
      gateway: true,
      multimodal: isMultimodalImageLlm(modelId),
    },
    brandRefsUnsupported: true,
  }
  assertGeneratedAssetQc(asset)
  return asset
}
