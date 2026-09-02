/**
 * Wave 2J / #581 — pinned multimodal visual embedder (ADR-0052).
 * Text retrieval stays openai/text-embedding-3-small (1536-d, not a profile role).
 *
 * Gemini Embedding 2 natively emits 3072-d; we pin Matryoshka outputDimensionality
 * 1536 so visual rows fit `asset_embeddings.embedding vector(1536)` without resizing
 * text. kind=text and kind=visual still live in different spaces — never cosine-mix them.
 */

export const ASSET_VISUAL_EMBEDDING_MODEL_ID = 'google/gemini-embedding-2' as const
export const ASSET_VISUAL_EMBEDDING_DIMS = 1536 as const
export const CI_STUB_VISUAL_EMBEDDING_MODEL_ID = 'mock-embed-visual' as const

export const ASSET_VISUAL_EMBEDDING_PROVIDER_OPTIONS = {
  google: { outputDimensionality: ASSET_VISUAL_EMBEDDING_DIMS },
} as const

export const PAID_EMBED_VISUAL_REF = {
  modelId: ASSET_VISUAL_EMBEDDING_MODEL_ID,
  providerOptions: ASSET_VISUAL_EMBEDDING_PROVIDER_OPTIONS,
} as const

export const CI_STUB_EMBED_VISUAL_REF = {
  modelId: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
} as const

/** Deterministic unit vector for CI — length ASSET_VISUAL_EMBEDDING_DIMS. */
export const mockVisualEmbedding = (seed: string): number[] => {
  const out = new Array<number>(ASSET_VISUAL_EMBEDDING_DIMS).fill(0)
  let h = 2166136261
  const salted = `visual:${seed}`
  for (let i = 0; i < salted.length; i += 1) {
    h ^= salted.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = 0; i < ASSET_VISUAL_EMBEDDING_DIMS; i += 1) {
    h ^= i + 1
    h = Math.imul(h, 16777619)
    out[i] = ((h >>> 0) % 10_000) / 10_000 - 0.5
  }
  const norm = Math.sqrt(out.reduce((sum, value) => sum + value * value, 0)) || 1
  return out.map((value) => value / norm)
}
