/** #177 — retrieval helpers with mocked Supabase (no live DB). */

import { describe, expect, it, vi } from 'vitest'
import { describeAssetIndex, findAssetsByKeyword, listAssetsByTag } from './search'

const assetId = '11111111-1111-4111-8111-111111111111'
const productId = 'demo'

const thenable = (data: unknown = null, error: unknown = null) => ({
  then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve({ data, error }).then(resolve),
})

const retrievalClient = (fixtures: {
  tags?: Array<{ asset_id: string; tag: string }>
  states?: Array<Record<string, unknown>>
  assets?: Array<Record<string, unknown>>
  shots?: Array<Record<string, unknown>>
}) => {
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {}
    const finish = (data: unknown) => {
      Object.assign(builder, thenable(data, null))
      return builder
    }

    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.in = vi.fn(() => {
      if (table === 'asset_index_state') return finish(fixtures.states ?? [])
      if (table === 'asset_tags') return finish(fixtures.tags ?? [])
      if (table === 'assets') return finish(fixtures.assets ?? [])
      return finish([])
    })
    builder.ilike = vi.fn(() => {
      if (table === 'asset_index_state') {
        return finish(
          (fixtures.states ?? [])
            .filter((row) => row.status === 'ready')
            .map((row) => ({ asset_id: row.asset_id })),
        )
      }
      if (table === 'asset_tags') {
        return finish((fixtures.tags ?? []).map((row) => ({ asset_id: row.asset_id })))
      }
      if (table === 'assets') {
        return finish((fixtures.assets ?? []).map((row) => ({ id: row.id })))
      }
      return finish([])
    })
    builder.filter = vi.fn(() => finish([]))
    builder.limit = vi.fn(() => builder)
    builder.order = vi.fn(() => {
      if (table === 'asset_shots') return finish(fixtures.shots ?? [])
      return finish([])
    })
    builder.maybeSingle = vi.fn(async () => ({
      data: (fixtures.states ?? [])[0] ?? null,
      error: null,
    }))

    // listAssetsByTag: .eq('tag') then await query — needs thenable after eq chain
    const originalEq = builder.eq as (...args: unknown[]) => unknown
    builder.eq = vi.fn((...args: unknown[]) => {
      originalEq(...args)
      if (table === 'asset_tags' && args[0] === 'tag') {
        return finish(fixtures.tags ?? [])
      }
      if (table === 'asset_tags' && args[0] === 'asset_id') {
        return finish((fixtures.tags ?? []).map((row) => ({ tag: row.tag })))
      }
      if (table === 'asset_shots') return builder
      if (table === 'asset_index_state' && args[0] === 'product_id') return builder
      return builder
    })

    return builder
  })

  return { from }
}

describe('retrieval helpers (#177)', () => {
  it('listAssetsByTag hydrates ready hits for an exact tag', async () => {
    const supabase = retrievalClient({
      tags: [{ asset_id: assetId, tag: 'product' }],
      states: [
        {
          asset_id: assetId,
          product_id: productId,
          caption: 'Desk product',
          transcript_excerpt: null,
          status: 'ready',
        },
      ],
      assets: [{ id: assetId, kind: 'image', blob_key: 'local/demo/a.jpg', probe: null }],
    })

    const hits = await listAssetsByTag({
      supabase: supabase as never,
      productId,
      tag: 'Product',
    })
    expect(hits).toEqual([
      expect.objectContaining({
        assetId,
        caption: 'Desk product',
        tags: ['product'],
        kind: 'image',
        distance: null,
      }),
    ])
  })

  it('listAssetsByTag returns [] for empty/normalized-away tags', async () => {
    const supabase = retrievalClient({})
    expect(await listAssetsByTag({ supabase: supabase as never, productId, tag: '   ' })).toEqual(
      [],
    )
  })

  it('describeAssetIndex returns caption, tags, and shots', async () => {
    const shotId = '22222222-2222-4222-8222-222222222222'
    const supabase = retrievalClient({
      states: [
        {
          asset_id: assetId,
          product_id: productId,
          status: 'ready',
          stage: 'ready',
          caption: 'Close-up',
          transcript_excerpt: 'hello',
          last_error: null,
        },
      ],
      tags: [{ asset_id: assetId, tag: 'close-up' }],
      shots: [
        {
          id: shotId,
          ordinal: 0,
          start_ms: 0,
          end_ms: 4000,
          thumb_blob_key: null,
        },
      ],
    })

    const description = await describeAssetIndex({
      supabase: supabase as never,
      productId,
      assetId,
    })
    expect(description).toEqual(
      expect.objectContaining({
        assetId,
        caption: 'Close-up',
        transcriptExcerpt: 'hello',
        tags: ['close-up'],
        shots: [expect.objectContaining({ id: shotId, startMs: 0, endMs: 4000 })],
      }),
    )
  })

  it('describeAssetIndex returns null when index row missing', async () => {
    const supabase = retrievalClient({ states: [] })
    expect(await describeAssetIndex({ supabase: supabase as never, productId, assetId })).toBeNull()
  })

  it('findAssetsByKeyword matches caption and hydrates unindexed filename hits', async () => {
    const supabase = retrievalClient({
      states: [
        {
          asset_id: assetId,
          product_id: productId,
          caption: 'funny product moment',
          transcript_excerpt: null,
          status: 'ready',
        },
      ],
      assets: [
        {
          id: assetId,
          kind: 'video',
          blob_key: 'local/demo/uploads/funny.mp4',
          probe: { name: 'funny.mp4' },
        },
      ],
      tags: [],
    })

    const hits = await findAssetsByKeyword({
      supabase: supabase as never,
      productId,
      query: 'funny',
    })
    expect(hits[0]).toEqual(
      expect.objectContaining({
        assetId,
        caption: 'funny product moment',
        kind: 'video',
      }),
    )
  })
})
