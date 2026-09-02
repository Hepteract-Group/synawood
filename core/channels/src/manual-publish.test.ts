import { describe, expect, it, vi } from 'vitest'
import {
  createManualPublishAdapter,
  POSTED_CANCEL_COPY,
  recordManualPosted,
} from './manual-publish'

const finalRow = {
  id: 'fa_1',
  product_id: 'demo',
  project_id: 'proj_1',
  primary_asset_id: 'asset_final',
}

const makeSupabase = (opts: {
  final?: typeof finalRow | null
  projectStatus?: string | null
  insertError?: { message: string } | null
  existingRecord?: Record<string, unknown> | null
  updateError?: { message: string } | null
}) => {
  const inserted: Record<string, unknown>[] = []
  const updated: Record<string, unknown>[] = []
  return {
    inserted,
    updated,
    client: {
      from: vi.fn((table: string) => {
        if (table === 'final_assets') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: opts.final === undefined ? finalRow : opts.final,
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'studio_projects') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data:
                    opts.projectStatus === null
                      ? null
                      : { status: opts.projectStatus ?? 'approved' },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'publish_records') {
          return {
            insert: (row: Record<string, unknown>) => {
              inserted.push(row)
              if (opts.insertError) {
                return {
                  select: () => ({
                    single: async () => ({ data: null, error: opts.insertError }),
                  }),
                }
              }
              return {
                select: () => ({
                  single: async () => ({
                    data: {
                      ...row,
                      content_slot_id: row.content_slot_id ?? null,
                      scheduled_at: row.scheduled_at ?? null,
                      posted_at: null,
                      external_url: null,
                      postiz_id: null,
                      caption: row.caption ?? null,
                    },
                    error: null,
                  }),
                }),
              }
            },
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: opts.existingRecord ?? null,
                  error: null,
                }),
              }),
            }),
            update: (patch: Record<string, unknown>) => {
              updated.push(patch)
              return {
                eq: () => ({
                  select: () => ({
                    single: async () =>
                      opts.updateError
                        ? { data: null, error: opts.updateError }
                        : {
                            data: {
                              ...(opts.existingRecord ?? {}),
                              ...patch,
                              id: (opts.existingRecord?.id as string) ?? 'pr_1',
                              product_id: 'demo',
                              final_asset_id: 'fa_1',
                              content_slot_id: null,
                              channel: 'linkedin_founder',
                              caption: null,
                              scheduled_at: null,
                              postiz_id: null,
                              created_at: '2026-07-20T00:00:00.000Z',
                            },
                            error: null,
                          },
                  }),
                }),
              }
            },
          }
        }
        return {}
      }),
    },
  }
}

describe('createManualPublishAdapter', () => {
  it('creates a ready publish_records row with status history', async () => {
    const { client, inserted } = makeSupabase({})
    const adapter = createManualPublishAdapter(client as never)
    const result = await adapter.schedule({
      productId: 'demo',
      finalAssetId: 'fa_1',
      channel: 'linkedin_founder',
      caption: 'Hello founders',
    })
    expect(result.record.status).toBe('ready')
    expect(result.externalId).toBe(result.record.id)
    expect(result.instructions.toLowerCase()).toContain('download')
    expect(result.record.statusHistory[0]?.status).toBe('ready')
    expect(inserted[0]?.status).toBe('ready')
    expect(inserted[0]?.caption).toBe('Hello founders')
  })

  it('refuses when Final asset is missing', async () => {
    const { client } = makeSupabase({ final: null })
    const adapter = createManualPublishAdapter(client as never)
    await expect(
      adapter.schedule({
        productId: 'demo',
        finalAssetId: 'missing',
        channel: 'x_founder',
      }),
    ).rejects.toThrow(/Final asset not found/)
  })

  it('refuses when the Studio project is killed', async () => {
    const { client } = makeSupabase({ projectStatus: 'killed' })
    const adapter = createManualPublishAdapter(client as never)
    await expect(
      adapter.schedule({
        productId: 'demo',
        finalAssetId: 'fa_1',
        channel: 'linkedin_founder',
      }),
    ).rejects.toThrow(/discarded \(killed\)/)
  })
})

describe('recordManualPosted', () => {
  it('transitions ready → manual_posted and stores URL', async () => {
    const existing = {
      id: 'pr_1',
      product_id: 'demo',
      final_asset_id: 'fa_1',
      content_slot_id: null,
      channel: 'linkedin_founder',
      status: 'ready',
      caption: null,
      scheduled_at: null,
      posted_at: null,
      external_url: null,
      postiz_id: null,
      status_history: [{ status: 'ready', at: '2026-07-20T00:00:00.000Z' }],
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
    }
    const { client, updated } = makeSupabase({ existingRecord: existing })
    const record = await recordManualPosted(client as never, {
      publishRecordId: 'pr_1',
      postedUrl: 'https://www.linkedin.com/posts/example',
    })
    expect(record.status).toBe('manual_posted')
    expect(record.externalUrl).toBe('https://www.linkedin.com/posts/example')
    expect(updated[0]?.status).toBe('manual_posted')
    expect(record.statusHistory.map((e) => e.status)).toEqual(['ready', 'manual_posted'])
  })

  it('is idempotent for the same URL', async () => {
    const existing = {
      id: 'pr_1',
      product_id: 'demo',
      final_asset_id: 'fa_1',
      content_slot_id: null,
      channel: 'x_founder',
      status: 'manual_posted',
      caption: null,
      scheduled_at: null,
      posted_at: '2026-07-20T01:00:00.000Z',
      external_url: 'https://x.com/demo/status/1',
      postiz_id: null,
      status_history: [],
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T01:00:00.000Z',
    }
    const { client, updated } = makeSupabase({ existingRecord: existing })
    const record = await recordManualPosted(client as never, {
      publishRecordId: 'pr_1',
      postedUrl: 'https://x.com/demo/status/1',
    })
    expect(record.status).toBe('manual_posted')
    expect(updated).toHaveLength(0)
  })

  it('rejects non-absolute URLs', async () => {
    const existing = {
      id: 'pr_1',
      product_id: 'demo',
      final_asset_id: 'fa_1',
      content_slot_id: null,
      channel: 'linkedin_founder',
      status: 'ready',
      caption: null,
      scheduled_at: null,
      posted_at: null,
      external_url: null,
      postiz_id: null,
      status_history: [],
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
    }
    const { client } = makeSupabase({ existingRecord: existing })
    await expect(
      recordManualPosted(client as never, {
        publishRecordId: 'pr_1',
        postedUrl: 'linkedin.com/posts/x',
      }),
    ).rejects.toThrow(/absolute http/)
  })
})

describe('createManualPublishAdapter.cancel (#802)', () => {
  it('marks a ready row skipped', async () => {
    const existing = {
      id: 'pr_1',
      product_id: 'demo',
      final_asset_id: 'fa_1',
      content_slot_id: null,
      channel: 'linkedin_founder',
      status: 'ready',
      caption: null,
      scheduled_at: null,
      posted_at: null,
      external_url: null,
      postiz_id: null,
      status_history: [{ status: 'ready', at: '2026-07-20T00:00:00.000Z' }],
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
    }
    const { client, updated } = makeSupabase({ existingRecord: existing })
    const adapter = createManualPublishAdapter(client as never)
    const result = await adapter.cancel('pr_1')
    expect(result.status).toBe('skipped')
    expect(updated[0]?.status).toBe('skipped')
  })

  it('refuses to silently delete a posted row', async () => {
    const existing = {
      id: 'pr_1',
      product_id: 'demo',
      final_asset_id: 'fa_1',
      content_slot_id: null,
      channel: 'linkedin_founder',
      status: 'posted',
      caption: null,
      scheduled_at: null,
      posted_at: '2026-07-20T01:00:00.000Z',
      external_url: 'https://www.linkedin.com/posts/example',
      postiz_id: 'pz_1',
      status_history: [],
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T01:00:00.000Z',
    }
    const { client, updated } = makeSupabase({ existingRecord: existing })
    const adapter = createManualPublishAdapter(client as never)
    await expect(adapter.cancel('pr_1')).rejects.toThrow(POSTED_CANCEL_COPY)
    expect(updated).toHaveLength(0)
  })
})
