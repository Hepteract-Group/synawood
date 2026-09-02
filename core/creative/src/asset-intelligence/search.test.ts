import { describe, expect, it, vi } from 'vitest'
import { formatPgVector } from './embed'
import { ASSET_EMBEDDING_DIMS } from './schema'
import {
  CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
  mockVisualEmbedding,
} from '../model-profiles/embed-visual'
import {
  cosineDistance,
  filterByMaxDistance,
  findShotEmbeddingsSemantic,
  MAX_TEXT_SEMANTIC_DISTANCE,
  MAX_VISUAL_SEMANTIC_DISTANCE,
  queryVectorForTests,
  rankByCosineDistance,
} from './search'

describe('cosineDistance / rankByCosineDistance', () => {
  it('ranks closer vectors first', () => {
    const query = queryVectorForTests('product desk').embedding
    const near = queryVectorForTests('product desk').embedding
    const far = new Array<number>(ASSET_EMBEDDING_DIMS).fill(0)
    far[0] = 1
    const ranked = rankByCosineDistance(
      query,
      [
        { id: 'far', embedding: far },
        { id: 'near', embedding: near },
      ],
      2,
    )
    expect(ranked[0]?.id).toBe('near')
    expect(ranked[0]?.distance).toBeLessThan(ranked[1]!.distance)
  })

  it('returns 0 for identical unit vectors', () => {
    const vector = queryVectorForTests('same').embedding
    expect(cosineDistance(vector, vector)).toBeCloseTo(0, 5)
  })
})

describe('filterByMaxDistance (#443)', () => {
  it('drops weak semantic neighbours so sole unrelated hits do not win', () => {
    const kept = filterByMaxDistance(
      [
        { assetId: 'near', distance: 0.2 },
        { assetId: 'weak', distance: MAX_TEXT_SEMANTIC_DISTANCE + 0.1 },
        { assetId: 'keyword', distance: null },
      ],
      MAX_TEXT_SEMANTIC_DISTANCE,
    )
    expect(kept.map((row) => row.assetId)).toEqual(['near', 'keyword'])
  })

  it('drops weak visual neighbours using MAX_VISUAL_SEMANTIC_DISTANCE (#583)', () => {
    const kept = filterByMaxDistance(
      [
        { shotId: 'near', distance: 0.2 },
        { shotId: 'far', distance: MAX_VISUAL_SEMANTIC_DISTANCE + 0.2 },
      ],
      MAX_VISUAL_SEMANTIC_DISTANCE,
    )
    expect(kept.map((row) => row.shotId)).toEqual(['near'])
  })
})

describe('findShotEmbeddingsSemantic visual fallback (#583)', () => {
  it('ranks kind=visual rows in-process when the RPC is missing', async () => {
    const query = 'product close-up'
    const uiShot = '22222222-2222-4222-8222-222222222222'
    const officeShot = '33333333-3333-4333-8333-333333333333'
    const rows = [
      {
        asset_id: '11111111-1111-4111-8111-111111111111',
        shot_id: officeShot,
        embedding: formatPgVector(mockVisualEmbedding('office hallway')),
        model_id: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      },
      {
        asset_id: '11111111-1111-4111-8111-111111111111',
        shot_id: uiShot,
        embedding: formatPgVector(mockVisualEmbedding(query)),
        model_id: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      },
    ]
    const builder: Record<string, unknown> = {}
    const finish = () => {
      Object.assign(builder, {
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      })
      return builder
    }
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.not = vi.fn(() => finish())
    const supabase = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'no rpc' } })),
      from: vi.fn(() => builder),
    }

    const hits = await findShotEmbeddingsSemantic({
      supabase: supabase as never,
      productId: 'demo',
      query,
      useMock: true,
      kind: 'visual',
    })
    expect(hits[0]?.shotId).toBe(uiShot)
    expect(hits[0]?.distance).toBeLessThan(0.01)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'match_shot_embeddings',
      expect.objectContaining({ p_kind: 'visual', p_model_id: CI_STUB_VISUAL_EMBEDDING_MODEL_ID }),
    )
  })

  it('matches a still query vector to the similar video Shot (#593)', async () => {
    const stillVector = mockVisualEmbedding('demo-ui-still')
    const uiShot = '22222222-2222-4222-8222-222222222222'
    const officeShot = '33333333-3333-4333-8333-333333333333'
    const rows = [
      {
        asset_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        shot_id: officeShot,
        embedding: formatPgVector(mockVisualEmbedding('office hallway')),
        model_id: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      },
      {
        asset_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        shot_id: uiShot,
        embedding: formatPgVector(stillVector),
        model_id: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      },
    ]
    const builder: Record<string, unknown> = {}
    const finish = () => {
      Object.assign(builder, {
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      })
      return builder
    }
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.not = vi.fn(() => finish())
    const supabase = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'no rpc' } })),
      from: vi.fn(() => builder),
    }
    const hits = await findShotEmbeddingsSemantic({
      supabase: supabase as never,
      productId: 'demo',
      query: '',
      useMock: true,
      kind: 'visual',
      queryVector: {
        embedding: stillVector,
        pgVector: formatPgVector(stillVector),
        modelId: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      },
    })
    expect(hits[0]?.shotId).toBe(uiShot)
    expect(hits.map((hit) => hit.shotId)).not.toContain(officeShot)
  })
})
