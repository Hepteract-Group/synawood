/** #513 — shot-level Moment ranking (no live DB). */

import { describe, expect, it, vi } from 'vitest'
import { findMoments, rankMoments, type MomentCandidate } from './moments'
import { formatPgVector } from './embed'
import {
  CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
  mockVisualEmbedding,
} from '../model-profiles/embed-visual'
import { highlightScoresFromResult } from './highlight-pack'
import { placeShotOnProject } from './place-shot'
import { attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'

const takeId = '11111111-1111-4111-8111-111111111111'
const closeUpShot = '22222222-2222-4222-8222-222222222222'
const wideShot = '33333333-3333-4333-8333-333333333333'

const candidates = (): MomentCandidate[] => [
  {
    assetId: takeId,
    shotId: wideShot,
    startMs: 0,
    endMs: 40_000,
    caption: 'Office walkthrough of the product',
    transcriptExcerpt: 'here is the whole take of the office',
    tags: ['office', 'wide'],
  },
  {
    assetId: takeId,
    shotId: closeUpShot,
    startMs: 8_000,
    endMs: 10_000,
    caption: 'Product close-up on the Export button',
    transcriptExcerpt: 'tap export to save the pdf',
    tags: ['product', 'close-up', 'proof'],
  },
]

describe('rankMoments (#513)', () => {
  it('returns the 2s product close-up with its in/out, not the 40s take', () => {
    const hits = rankMoments({
      query: 'product close-up',
      candidates: candidates(),
    })
    expect(hits[0]).toEqual(
      expect.objectContaining({
        assetId: takeId,
        shotId: closeUpShot,
        startMs: 8_000,
        endMs: 10_000,
      }),
    )
    expect(hits[0]!.score).toBeGreaterThan(hits[1]?.score ?? 0)
    expect(hits[0]!.endMs! - hits[0]!.startMs).toBe(2_000)
  })

  it('boosts Analyze highlight scores when sort is highlight (#590)', () => {
    const without = rankMoments({
      query: 'product',
      candidates: candidates(),
    })
    const withHighlight = rankMoments({
      query: 'product',
      candidates: candidates(),
      highlightScoreByShot: new Map([[wideShot, 80]]),
    })
    expect(withHighlight[0]?.shotId).toBe(wideShot)
    expect(without[0]?.shotId).toBe(closeUpShot)
  })

  it('sort=highlight without Analyze scores matches relevance (#666)', () => {
    const relevance = rankMoments({
      query: 'product',
      candidates: candidates(),
    })
    const highlight = rankMoments({
      query: 'product',
      candidates: candidates(),
      highlightScoreByShot: undefined,
    })
    expect(highlight.map((hit) => hit.shotId)).toEqual(relevance.map((hit) => hit.shotId))
  })

  it('places the top ranked shot trim, including window-only Analyze JSON (#590)', () => {
    const scores = highlightScoresFromResult(
      {
        moments: [{ startMs: 8_000, endMs: 10_000, score: 99, label: 'proof' }],
      },
      [
        { id: wideShot, startMs: 0, endMs: 40_000 },
        { id: closeUpShot, startMs: 8_000, endMs: 10_000 },
      ],
    )
    const hits = rankMoments({
      query: 'product',
      candidates: candidates(),
      highlightScoreByShot: scores,
    })
    expect(hits[0]?.shotId).toBe(closeUpShot)
    expect(hits[0]?.startMs).toBe(8_000)
    expect(hits[0]?.endMs).toBe(10_000)
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: takeId,
      kind: 'video',
      blobKey: 'local/take.mp4',
      source: 'upload',
      probe: { durationFrames: 1200 },
    })
    const next = placeShotOnProject(project, {
      assetId: hits[0]!.assetId,
      startMs: hits[0]!.startMs,
      endMs: hits[0]!.endMs,
    })
    expect(next.clips[0]?.trim.startFrames).toBe(240)
    expect(next.clips[0]?.durationInFrames).toBe(60)
  })

  it('returns [] when the index has no shots', () => {
    expect(rankMoments({ query: 'product close-up', candidates: [] })).toEqual([])
  })

  it('filters by tag so unmatched shots drop', () => {
    const hits = rankMoments({
      query: 'product',
      tag: 'close-up',
      candidates: candidates(),
    })
    expect(hits.map((hit) => hit.shotId)).toEqual([closeUpShot])
  })

  it('filters by scene role using matching tags', () => {
    const hits = rankMoments({
      query: 'export',
      sceneRole: 'proof',
      candidates: candidates(),
    })
    expect(hits.map((hit) => hit.shotId)).toEqual([closeUpShot])
  })
})

describe('rankMoments transcript windows (#515)', () => {
  it('hits the shot whose window contains the spoken phrase', () => {
    const hits = rankMoments({
      query: 'pricing',
      candidates: [
        {
          assetId: takeId,
          shotId: wideShot,
          startMs: 0,
          endMs: 8_000,
          caption: 'Office walkthrough',
          transcriptExcerpt: 'welcome to the product walkthrough',
          tags: ['office'],
        },
        {
          assetId: takeId,
          shotId: closeUpShot,
          startMs: 8_000,
          endMs: 12_000,
          caption: 'Office walkthrough',
          transcriptExcerpt: 'our pricing starts at nine pounds',
          tags: ['office'],
        },
      ],
    })
    expect(hits[0]?.shotId).toBe(closeUpShot)
    expect(hits.map((hit) => hit.shotId)).not.toContain(wideShot)
  })

  it('still ranks caption/tag hits when shot embeddings are missing', () => {
    const hits = rankMoments({
      query: 'product close-up',
      candidates: candidates(),
      distanceByShot: new Map(),
    })
    expect(hits[0]?.shotId).toBe(closeUpShot)
  })
})

describe('rankMoments visual+text fusion (#583)', () => {
  it('ranks a visual-similar shot above a caption-only distractor', () => {
    const uiShot = closeUpShot
    const officeShot = wideShot
    const hits = rankMoments({
      query: 'product close-up',
      candidates: [
        {
          assetId: takeId,
          shotId: officeShot,
          startMs: 0,
          endMs: 40_000,
          caption: 'product close-up on a poster',
          transcriptExcerpt: null,
          tags: ['office'],
        },
        {
          assetId: takeId,
          shotId: uiShot,
          startMs: 8_000,
          endMs: 10_000,
          caption: 'screen',
          transcriptExcerpt: null,
          tags: ['ui'],
        },
      ],
      visualDistanceByShot: new Map([[uiShot, 0.12]]),
      distanceByShot: new Map(),
    })
    expect(hits[0]?.shotId).toBe(uiShot)
  })

  it('drops visual neighbours beyond MAX_VISUAL_SEMANTIC_DISTANCE', () => {
    const hits = rankMoments({
      query: 'red laptop',
      candidates: [
        {
          assetId: takeId,
          shotId: wideShot,
          startMs: 0,
          endMs: 8_000,
          caption: 'hallway',
          transcriptExcerpt: null,
          tags: [],
        },
      ],
      visualDistanceByShot: new Map([[wideShot, 0.9]]),
    })
    expect(hits).toEqual([])
  })

  it('still returns tag/caption hits when the visual table is empty', () => {
    const hits = rankMoments({
      query: 'product close-up',
      candidates: candidates(),
      visualDistanceByShot: new Map(),
    })
    expect(hits[0]?.shotId).toBe(closeUpShot)
  })
})

const thenable = (data: unknown = [], error: unknown = null) => ({
  then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve({ data, error }).then(resolve),
})

const momentsClient = (fixtures: {
  states?: Array<Record<string, unknown>>
  shots?: Array<Record<string, unknown>>
  tags?: Array<Record<string, unknown>>
}) => {
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {}
    const data =
      table === 'asset_index_state'
        ? (fixtures.states ?? [])
        : table === 'asset_shots'
          ? (fixtures.shots ?? [])
          : table === 'asset_tags'
            ? (fixtures.tags ?? [])
            : []
    Object.assign(builder, thenable(data, null))
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.in = vi.fn(() => builder)
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    return builder
  })
  return { from }
}

describe('findMoments (#513)', () => {
  it('returns ok-shaped empty hits when the product has no index', async () => {
    const hits = await findMoments({
      supabase: momentsClient({}) as never,
      productId: 'demo',
      query: 'product close-up',
    })
    expect(hits).toEqual([])
  })

  it('maps a matching shot window instead of the whole asset id only', async () => {
    const hits = await findMoments({
      supabase: momentsClient({
        states: [
          {
            asset_id: takeId,
            caption: 'Product close-up on the Export button',
            transcript_excerpt: 'tap export to save the pdf',
            status: 'ready',
          },
        ],
        shots: [
          { id: wideShot, asset_id: takeId, start_ms: 0, end_ms: 40_000 },
          { id: closeUpShot, asset_id: takeId, start_ms: 8_000, end_ms: 10_000 },
        ],
        tags: [
          { asset_id: takeId, tag: 'product' },
          { asset_id: takeId, tag: 'close-up' },
        ],
      }) as never,
      productId: 'demo',
      query: 'product close-up',
    })
    expect(hits[0]).toEqual(
      expect.objectContaining({
        assetId: takeId,
        shotId: closeUpShot,
        startMs: 8_000,
        endMs: 10_000,
      }),
    )
  })

  it('windows transcript timestamps onto the shot that said the phrase', async () => {
    const hits = await findMoments({
      supabase: momentsClient({
        states: [
          {
            asset_id: takeId,
            caption: 'Office walkthrough',
            transcript_excerpt:
              'welcome to the product walkthrough our pricing starts at nine pounds',
            transcript_segments: [
              { startMs: 0, endMs: 8_000, text: 'welcome to the product walkthrough' },
              { startMs: 8_000, endMs: 12_000, text: 'our pricing starts at nine pounds' },
            ],
            status: 'ready',
          },
        ],
        shots: [
          { id: wideShot, asset_id: takeId, start_ms: 0, end_ms: 8_000 },
          { id: closeUpShot, asset_id: takeId, start_ms: 8_000, end_ms: 12_000 },
        ],
        tags: [{ asset_id: takeId, tag: 'office' }],
      }) as never,
      productId: 'demo',
      query: 'pricing',
    })
    expect(hits[0]?.shotId).toBe(closeUpShot)
    expect(hits.map((hit) => hit.shotId)).not.toContain(wideShot)
  })

  it('sort=highlight with no Analyze rows still ranks (#666)', async () => {
    const relevance = await findMoments({
      supabase: momentsClient({
        states: [
          {
            asset_id: takeId,
            caption: 'Product close-up on the Export button',
            transcript_excerpt: 'tap export',
            status: 'ready',
          },
        ],
        shots: [
          { id: wideShot, asset_id: takeId, start_ms: 0, end_ms: 40_000 },
          { id: closeUpShot, asset_id: takeId, start_ms: 8_000, end_ms: 10_000 },
        ],
        tags: [
          { asset_id: takeId, tag: 'product' },
          { asset_id: takeId, tag: 'close-up' },
        ],
      }) as never,
      productId: 'demo',
      query: 'product close-up',
    })
    const highlight = await findMoments({
      supabase: momentsClient({
        states: [
          {
            asset_id: takeId,
            caption: 'Product close-up on the Export button',
            transcript_excerpt: 'tap export',
            status: 'ready',
          },
        ],
        shots: [
          { id: wideShot, asset_id: takeId, start_ms: 0, end_ms: 40_000 },
          { id: closeUpShot, asset_id: takeId, start_ms: 8_000, end_ms: 10_000 },
        ],
        tags: [
          { asset_id: takeId, tag: 'product' },
          { asset_id: takeId, tag: 'close-up' },
        ],
      }) as never,
      productId: 'demo',
      query: 'product close-up',
      sort: 'highlight',
    })
    expect(highlight.map((hit) => hit.shotId)).toEqual(relevance.map((hit) => hit.shotId))
    expect(highlight.length).toBeGreaterThan(0)
  })

  it('embeds a still at query time when no stored visual row exists (#661)', async () => {
    const stillId = '44444444-4444-4444-8444-444444444444'
    const stillVector = mockVisualEmbedding(stillId)
    const embeddingRows = [
      {
        asset_id: takeId,
        shot_id: wideShot,
        embedding: formatPgVector(mockVisualEmbedding('office hallway')),
        model_id: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      },
      {
        asset_id: takeId,
        shot_id: closeUpShot,
        embedding: formatPgVector(stillVector),
        model_id: CI_STUB_VISUAL_EMBEDDING_MODEL_ID,
      },
    ]
    const from = vi.fn((table: string) => {
      const builder: Record<string, unknown> = {}
      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn(() => builder)
      builder.in = vi.fn(() => builder)
      builder.not = vi.fn(() => builder)
      if (table === 'asset_index_state') {
        Object.assign(
          builder,
          thenable([
            {
              asset_id: takeId,
              caption: 'Office walkthrough',
              transcript_excerpt: 'welcome to the product',
              status: 'ready',
            },
          ]),
        )
      } else if (table === 'asset_shots') {
        Object.assign(
          builder,
          thenable([
            { id: wideShot, asset_id: takeId, start_ms: 0, end_ms: 40_000 },
            { id: closeUpShot, asset_id: takeId, start_ms: 8_000, end_ms: 10_000 },
          ]),
        )
      } else if (table === 'asset_tags') {
        Object.assign(builder, thenable([]))
      } else if (table === 'assets') {
        builder.maybeSingle = vi.fn(async () => ({
          data: { blob_key: 'uploads/demo/still.jpg' },
          error: null,
        }))
        Object.assign(builder, thenable({ blob_key: 'uploads/demo/still.jpg' }))
      } else if (table === 'asset_embeddings') {
        Object.assign(builder, thenable(embeddingRows))
      } else {
        Object.assign(builder, thenable([]))
      }
      return builder
    })
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'no rpc' } }))
    const getBlobBytes = vi.fn(async () => Buffer.alloc(32, 7))
    const hits = await findMoments({
      supabase: { from, rpc } as never,
      productId: 'demo',
      query: '',
      imageAssetId: stillId,
      blobEnv: {
        connectionString: 'UseDevelopmentStorage=true',
        containerName: 'media',
        useLocalPrefix: true,
        accountName: 'devstoreaccount1',
        accountKey: 'key',
      },
      getBlobBytes,
      useMock: true,
    })
    expect(getBlobBytes).toHaveBeenCalled()
    expect(hits[0]?.shotId).toBe(closeUpShot)
    const rpcCalls = rpc.mock.calls as unknown as Array<
      [string, { p_kind?: string; p_query?: string }]
    >
    const visualRpc = rpcCalls.find((call) => call[1]?.p_kind === 'visual')
    expect(visualRpc?.[1]).toEqual(
      expect.objectContaining({
        p_kind: 'visual',
        p_query: formatPgVector(stillVector),
      }),
    )
  })

  it('does not embed a UUID as a visual query when the still cannot be encoded (#593)', async () => {
    const stillId = '44444444-4444-4444-8444-444444444444'
    const from = vi.fn((table: string) => {
      const builder: Record<string, unknown> = {}
      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn(() => builder)
      builder.in = vi.fn(() => builder)
      builder.not = vi.fn(() => builder)
      builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
      if (table === 'asset_index_state') {
        Object.assign(
          builder,
          thenable([
            {
              asset_id: takeId,
              caption: 'Office walkthrough',
              transcript_excerpt: 'welcome to the product',
              status: 'ready',
            },
          ]),
        )
      } else if (table === 'asset_shots') {
        Object.assign(
          builder,
          thenable([
            { id: wideShot, asset_id: takeId, start_ms: 0, end_ms: 40_000 },
            { id: closeUpShot, asset_id: takeId, start_ms: 8_000, end_ms: 10_000 },
          ]),
        )
      } else {
        Object.assign(builder, thenable([]))
      }
      return builder
    })
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'no rpc' } }))
    await findMoments({
      supabase: { from, rpc } as never,
      productId: 'demo',
      query: stillId,
      imageAssetId: stillId,
      useMock: true,
    })
    const rpcCalls = rpc.mock.calls as unknown as Array<
      [string, { p_kind?: string; p_query?: string }]
    >
    expect(rpcCalls.some((call) => call[1]?.p_kind === 'visual')).toBe(false)
  })
})
