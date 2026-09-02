import { describe, expect, it } from 'vitest'
import { ASSET_TEXT_EMBEDDING_MODEL_ID } from '../asset-intelligence/embed'
import { ASSET_EMBEDDING_DIMS } from '../asset-intelligence/schema'
import {
  ASSET_VISUAL_EMBEDDING_DIMS,
  ASSET_VISUAL_EMBEDDING_MODEL_ID,
  mockVisualEmbedding,
} from './embed-visual'
import { MODEL_PROFILE_IDS, resolveModelRef } from './registry'

describe('embed_visual role (#581)', () => {
  it('resolves embed_visual on every starter profile', () => {
    for (const id of MODEL_PROFILE_IDS) {
      const ref = resolveModelRef(id, 'embed_visual')
      expect(ref.modelId.length).toBeGreaterThan(0)
    }
  })

  it('pins paid profiles to Gemini Embedding 2 at 1536-d, not text-embedding-3-small', () => {
    const ref = resolveModelRef('balanced', 'embed_visual')
    expect(ref.modelId).toBe(ASSET_VISUAL_EMBEDDING_MODEL_ID)
    expect(ref.modelId).not.toBe(ASSET_TEXT_EMBEDDING_MODEL_ID)
    expect(ref.providerOptions).toEqual({ google: { outputDimensionality: 1536 } })
    expect(ASSET_VISUAL_EMBEDDING_DIMS).toBe(1536)
    expect(ASSET_EMBEDDING_DIMS).toBe(1536)
  })

  it('uses a deterministic mock vector of the pinned visual dim on ci-stub', () => {
    expect(resolveModelRef('ci-stub', 'embed_visual').modelId).toBe('mock-embed-visual')
    const vector = mockVisualEmbedding('shot-keyframe')
    expect(vector).toHaveLength(ASSET_VISUAL_EMBEDDING_DIMS)
    expect(mockVisualEmbedding('shot-keyframe')).toEqual(vector)
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
    expect(norm).toBeCloseTo(1, 5)
  })
})
