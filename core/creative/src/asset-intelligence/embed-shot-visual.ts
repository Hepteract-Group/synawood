/** Wave 2J / #582 — multimodal embed of a Shot keyframe (ADR-0052). */

import { embed as defaultEmbed, type EmbeddingModel } from 'ai'
import {
  ASSET_VISUAL_EMBEDDING_DIMS,
  ASSET_VISUAL_EMBEDDING_MODEL_ID,
  ASSET_VISUAL_EMBEDDING_PROVIDER_OPTIONS,
  CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
  mockVisualEmbedding,
} from '../model-profiles/embed-visual'
import { formatPgVector } from './embed'

export type EmbedShotVisualResult =
  | { skipped: false; modelId: string; embedding: number[]; pgVector: string }
  | { skipped: true; reason: string }

type EmbedFn = typeof defaultEmbed

export const embedShotVisualForIndex = async (
  input: {
    thumbBytes: Uint8Array
    seed: string
    useMock: boolean
    modelId: string
    mimeType?: string
  },
  deps?: { embed?: EmbedFn },
): Promise<EmbedShotVisualResult> => {
  if (input.thumbBytes.byteLength < 16) {
    return { skipped: true, reason: 'visual embed skipped: empty keyframe' }
  }

  const modelId = input.modelId.trim() || ASSET_VISUAL_EMBEDDING_MODEL_ID
  if (input.useMock || modelId.startsWith('mock-')) {
    const embedding = mockVisualEmbedding(input.seed)
    return {
      skipped: false,
      modelId: modelId.startsWith('mock-') ? modelId : CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      embedding,
      pgVector: formatPgVector(embedding),
    }
  }

  if (!process.env.AI_GATEWAY_API_KEY?.trim() && !deps?.embed) {
    return { skipped: true, reason: 'visual embed skipped: no AI Gateway key' }
  }

  const runEmbed = deps?.embed ?? defaultEmbed
  const mimeType = input.mimeType || 'image/jpeg'
  const { embedding } = await runEmbed({
    model: modelId as unknown as EmbeddingModel,
    value: 'shot keyframe',
    providerOptions: {
      google: {
        ...ASSET_VISUAL_EMBEDDING_PROVIDER_OPTIONS.google,
        content: [
          [
            {
              inlineData: {
                mimeType,
                data: Buffer.from(input.thumbBytes).toString('base64'),
              },
            },
          ],
        ],
      },
    },
  })
  if (!Array.isArray(embedding) || embedding.length !== ASSET_VISUAL_EMBEDDING_DIMS) {
    throw new Error(
      `Visual embedding dim mismatch: expected ${ASSET_VISUAL_EMBEDDING_DIMS}, got ${embedding?.length ?? 0}`,
    )
  }
  return {
    skipped: false,
    modelId,
    embedding,
    pgVector: formatPgVector(embedding),
  }
}

/** Text query into the visual space so find_moments can NN keyframes (#583). */
export const embedVisualQuery = async (
  input: {
    query: string
    useMock?: boolean
    modelId?: string
  },
  deps?: { embed?: EmbedFn },
): Promise<EmbedShotVisualResult> => {
  const query = input.query.trim()
  if (!query) return { skipped: true, reason: 'visual query embed skipped: empty query' }

  const modelId = input.modelId?.trim() || ASSET_VISUAL_EMBEDDING_MODEL_ID
  if (input.useMock || modelId.startsWith('mock-')) {
    const embedding = mockVisualEmbedding(query)
    return {
      skipped: false,
      modelId: modelId.startsWith('mock-') ? modelId : CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      embedding,
      pgVector: formatPgVector(embedding),
    }
  }

  if (!process.env.AI_GATEWAY_API_KEY?.trim() && !deps?.embed) {
    return { skipped: true, reason: 'visual query embed skipped: no AI Gateway key' }
  }

  const runEmbed = deps?.embed ?? defaultEmbed
  const { embedding } = await runEmbed({
    model: modelId as unknown as EmbeddingModel,
    value: query,
    providerOptions: ASSET_VISUAL_EMBEDDING_PROVIDER_OPTIONS,
  })
  if (!Array.isArray(embedding) || embedding.length !== ASSET_VISUAL_EMBEDDING_DIMS) {
    throw new Error(
      `Visual query embedding dim mismatch: expected ${ASSET_VISUAL_EMBEDDING_DIMS}, got ${embedding?.length ?? 0}`,
    )
  }
  return {
    skipped: false,
    modelId,
    embedding,
    pgVector: formatPgVector(embedding),
  }
}
