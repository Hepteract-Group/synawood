import { describe, expect, it, vi } from 'vitest'
import {
  listAssetAnalyses,
  listAssetAnalysesForAssets,
  replaceAssetAnalysis,
} from './analyze-persist'

describe('replaceAssetAnalysis (#585)', () => {
  it('deletes the same kind+schema_id then inserts the new row', async () => {
    const deleted: unknown[] = []
    const inserted: unknown[] = []
    const chain = {
      delete: vi.fn(() => chain),
      eq: vi.fn((col: string, value: unknown) => {
        deleted.push([col, value])
        return chain
      }),
      insert: vi.fn((row: unknown) => {
        inserted.push(row)
        return chain
      }),
      then: (resolve: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(resolve),
    }
    const supabase = { from: vi.fn(() => chain) }

    await replaceAssetAnalysis(supabase as never, {
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      productId: 'demo',
      shotId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      kind: 'custom',
      schemaId: 'schema-1',
      result: { summary: 'hello', startMs: 0, endMs: 2000 },
      modelId: 'mock-caption',
      startMs: 0,
      endMs: 2000,
    })

    expect(supabase.from).toHaveBeenCalledWith('asset_analyses')
    expect(deleted).toEqual(
      expect.arrayContaining([
        ['product_id', 'demo'],
        ['asset_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
        ['kind', 'custom'],
        ['schema_id', 'schema-1'],
      ]),
    )
    expect(inserted[0]).toMatchObject({
      asset_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'custom',
      schema_id: 'schema-1',
      model_id: 'mock-caption',
    })
  })
})

describe('listAssetAnalyses (#586)', () => {
  it('returns newest rows first, product-scoped, camelCased', async () => {
    const filters: unknown[] = []
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, value: unknown) => {
        filters.push([col, value])
        return chain
      }),
      order: vi.fn(() => chain),
      then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({
          data: [
            {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              asset_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              product_id: 'demo',
              shot_id: null,
              kind: 'custom',
              schema_id: 'schema-1',
              result: { summary: 'hello' },
              model_id: 'mock-caption',
              start_ms: 0,
              end_ms: 2000,
              created_at: '2026-08-20T00:00:00Z',
              updated_at: '2026-08-20T01:00:00Z',
            },
          ],
          error: null,
        }).then(resolve),
    }
    const supabase = { from: vi.fn(() => chain) }

    const rows = await listAssetAnalyses(supabase as never, {
      productId: 'demo',
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })

    expect(supabase.from).toHaveBeenCalledWith('asset_analyses')
    expect(filters).toEqual([
      ['product_id', 'demo'],
      ['asset_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    ])
    expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(rows[0]).toMatchObject({
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'custom',
      result: { summary: 'hello' },
      startMs: 0,
      endMs: 2000,
    })
  })
})

describe('listAssetAnalysesForAssets (#1200)', () => {
  it('returns empty without querying when there are no asset ids', async () => {
    const supabase = { from: vi.fn() }
    const rows = await listAssetAnalysesForAssets(supabase as never, {
      productId: 'demo',
      assetIds: [],
    })
    expect(rows).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('filters by product and the given asset ids', async () => {
    const filters: unknown[] = []
    const inFilters: unknown[] = []
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, value: unknown) => {
        filters.push([col, value])
        return chain
      }),
      in: vi.fn((col: string, value: unknown) => {
        inFilters.push([col, value])
        return chain
      }),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({
          data: [
            {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              asset_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              product_id: 'demo',
              shot_id: null,
              kind: 'highlight',
              schema_id: 'schema-1',
              result: { moments: [] },
              model_id: 'mock-caption',
              start_ms: null,
              end_ms: null,
              created_at: '2026-08-20T00:00:00Z',
              updated_at: '2026-08-20T01:00:00Z',
            },
          ],
          error: null,
        }).then(resolve),
    }
    const supabase = { from: vi.fn(() => chain) }

    const rows = await listAssetAnalysesForAssets(supabase as never, {
      productId: 'demo',
      assetIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    })

    expect(supabase.from).toHaveBeenCalledWith('asset_analyses')
    expect(filters).toEqual([['product_id', 'demo']])
    expect(inFilters).toEqual([['asset_id', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']]])
    expect(chain.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(80)
    expect(rows[0]?.kind).toBe('highlight')
  })
})
