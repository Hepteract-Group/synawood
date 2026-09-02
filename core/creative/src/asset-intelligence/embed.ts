/** Wave 2C / #166 — text (+ optional visual) embeddings for asset retrieval. */

import { createOpenAI } from '@ai-sdk/openai'
import { embed as defaultEmbed, type EmbeddingModel } from 'ai'
import { ASSET_EMBEDDING_DIMS } from './schema'

/** Pinned v1 text embedder (must match migration `vector(1536)`). */
export const ASSET_TEXT_EMBEDDING_MODEL_ID = 'openai/text-embedding-3-small' as const

export const buildEmbedText = (input: {
  caption: string | null
  transcriptExcerpt: string | null
}): string | null => {
  const parts = [input.caption, input.transcriptExcerpt]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
  if (parts.length === 0) return null
  return parts.join('\n\n').slice(0, 8_000)
}

/** Deterministic unit vector for CI / mock — length ASSET_EMBEDDING_DIMS. */
export const mockTextEmbedding = (seed: string): number[] => {
  const out = new Array<number>(ASSET_EMBEDDING_DIMS).fill(0)
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = 0; i < ASSET_EMBEDDING_DIMS; i += 1) {
    h ^= i + 1
    h = Math.imul(h, 16777619)
    out[i] = ((h >>> 0) % 10_000) / 10_000 - 0.5
  }
  const norm = Math.sqrt(out.reduce((sum, value) => sum + value * value, 0)) || 1
  return out.map((value) => value / norm)
}

export const formatPgVector = (values: number[]): string => {
  if (values.length !== ASSET_EMBEDDING_DIMS) {
    throw new Error(`Expected ${ASSET_EMBEDDING_DIMS}-d embedding, got ${values.length}`)
  }
  return `[${values.join(',')}]`
}

export type EmbedAssetResult =
  | {
      skipped: false
      text: { modelId: string; embedding: number[]; pgVector: string }
      visualSkippedReason: string
    }
  | { skipped: true; reason: string }

type EmbedFn = typeof defaultEmbed

const resolveEmbeddingModel = async (input: {
  modelId: string
  override?: EmbeddingModel
}): Promise<EmbeddingModel> => {
  if (input.override) return input.override
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return input.modelId as unknown as EmbeddingModel
  }
  if (process.env.OPENAI_API_KEY?.trim() && input.modelId.startsWith('openai/')) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return openai.embedding(input.modelId.replace(/^openai\//, ''))
  }
  throw new Error('No AI Gateway or OpenAI credentials for asset embeddings')
}

/**
 * Text embed of caption (+ transcript). Visual rows wait for #581/#582
 * even after keyframe thumbs exist (#580).
 */
export const VISUAL_EMBED_DEFERRED_REASON =
  'visual embed deferred: embed_visual role not shipped (#581)' as const

export const embedAssetForIndex = async (
  input: {
    caption: string | null
    transcriptExcerpt: string | null
    /** When true, produce mock vectors (ci-stub / tests). */
    useMock?: boolean
    modelId?: string
    modelOverride?: EmbeddingModel
  },
  deps?: { embed?: EmbedFn },
): Promise<EmbedAssetResult> => {
  const text = buildEmbedText({
    caption: input.caption,
    transcriptExcerpt: input.transcriptExcerpt,
  })
  if (!text) {
    return {
      skipped: true,
      reason: 'embed skipped: no caption or transcript yet',
    }
  }

  const modelId = input.modelId?.trim() || ASSET_TEXT_EMBEDDING_MODEL_ID
  const visualSkippedReason = VISUAL_EMBED_DEFERRED_REASON

  if (input.useMock || modelId.startsWith('mock-')) {
    const embedding = mockTextEmbedding(text)
    return {
      skipped: false,
      text: {
        modelId: modelId.startsWith('mock-') ? modelId : 'mock-embed',
        embedding,
        pgVector: formatPgVector(embedding),
      },
      visualSkippedReason,
    }
  }

  const runEmbed = deps?.embed ?? defaultEmbed
  const model =
    deps?.embed && !input.modelOverride
      ? (modelId as unknown as EmbeddingModel)
      : await resolveEmbeddingModel({ modelId, override: input.modelOverride })

  const { embedding } = await runEmbed({ model, value: text })
  if (!Array.isArray(embedding) || embedding.length !== ASSET_EMBEDDING_DIMS) {
    throw new Error(
      `Embedding dim mismatch: expected ${ASSET_EMBEDDING_DIMS}, got ${embedding?.length ?? 0}`,
    )
  }

  return {
    skipped: false,
    text: { modelId, embedding, pgVector: formatPgVector(embedding) },
    visualSkippedReason,
  }
}
