import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPostizPublishAdapter } from './postiz-publish'
import { createMockPostizFetch } from './postiz-mock-http'
import { POSTIZ_TYPE_ADS_COPY } from './postiz-settings-type'

const bytes = Buffer.from('fake-mp4-bytes')
const now = new Date('2026-08-26T12:00:00.000Z')
const scheduledAt = new Date('2026-08-27T10:00:00.000Z')

const mockEnv = {
  POSTIZ_ADAPTER: 'mock',
  POSTIZ_BASE_URL: 'https://api.postiz.com/public/v1',
  POSTIZ_API_KEY: 'pos_secret_do_not_log',
}

const scheduleInput = {
  productId: 'demo',
  finalAssetId: 'fa_1',
  channel: 'linkedin_founder' as const,
  caption: 'Hello founders',
  scheduledAt,
}

type FakeRow = Record<string, unknown>

const makeDb = (opts?: {
  bindingId?: string | null
  existing?: FakeRow | null
  asset?: FakeRow | null
  projectStatus?: string
}) => {
  const records: FakeRow[] = opts?.existing ? [{ ...opts.existing }] : []
  const binding =
    opts?.bindingId === null
      ? null
      : {
          id: 'bind_1',
          product_id: 'demo',
          channel: 'linkedin_founder',
          postiz_integration_id: opts?.bindingId ?? 'int_li',
          created_at: '2026-08-26T00:00:00.000Z',
          updated_at: '2026-08-26T00:00:00.000Z',
        }
  const asset = opts?.asset ?? {
    id: 'asset_final',
    blob_key: 'products/demo/finals/ad.mp4',
    content_type: 'video/mp4',
    kind: 'video',
  }

  const thenable = (result: { data: unknown; error: null }) => ({
    then: (resolve: (value: { data: unknown; error: null }) => unknown) => resolve(result),
  })

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'final_assets') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'fa_1',
                  product_id: 'demo',
                  project_id: 'proj_1',
                  primary_asset_id: 'asset_final',
                },
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
                data: { status: opts?.projectStatus ?? 'approved' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: asset, error: null }),
            }),
          }),
        }
      }
      if (table === 'product_channel_integrations') {
        const filters: FakeRow = {}
        const qb = {
          select: () => qb,
          eq: (col: string, value: string) => {
            filters[col] = value
            return qb
          },
          order: () => qb,
          maybeSingle: async () => ({ data: binding, error: null }),
          then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
            resolve({
              data: binding && filters.product_id === 'demo' ? [binding] : [],
              error: null,
            }),
        }
        return qb
      }
      if (table === 'publish_records') {
        const filters: FakeRow = {}
        const qb = {
          select: () => qb,
          eq: (col: string, value: string) => {
            filters[col] = value
            return qb
          },
          order: () => qb,
          maybeSingle: async () => {
            const match = records.find((row) =>
              Object.entries(filters).every(([col, value]) => row[col] === value),
            )
            return { data: match ?? null, error: null }
          },
          insert: (row: FakeRow) => {
            const full = {
              posted_at: null,
              external_url: null,
              content_slot_id: row.content_slot_id ?? null,
              caption: row.caption ?? null,
              scheduled_at: row.scheduled_at ?? null,
              ...row,
            }
            records.push(full)
            return {
              select: () => ({
                single: async () => ({ data: full, error: null }),
              }),
            }
          },
          update: (patch: FakeRow) => ({
            eq: (col: string, value: string) => {
              const match = records.find((row) => row[col] === value)
              if (match) Object.assign(match, patch)
              return {
                select: () => ({
                  single: async () => ({ data: match ?? null, error: null }),
                }),
              }
            },
          }),
          then: (resolve: (value: { data: unknown; error: null }) => unknown) => {
            const matched = records.filter((row) =>
              Object.entries(filters).every(([col, value]) => row[col] === value),
            )
            return resolve({ data: matched, error: null })
          },
        }
        return qb
      }
      return thenable({ data: null, error: null })
    }),
  }

  return { client, records }
}

describe('createPostizPublishAdapter.schedule (#801)', () => {
  it('schedules via POST /posts and persists postiz_id', async () => {
    const { client, records } = makeDb()
    const { fetchImpl, requests } = createMockPostizFetch()
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => bytes,
      now: () => now,
    })

    const result = await adapter.schedule(scheduleInput)

    expect(result.record.postizId).toBe('pz_1')
    expect(result.record.status).toBe('scheduled')
    expect(records[0]?.postiz_id).toBe('pz_1')
    expect(result.externalId).toBe(result.record.id)

    const create = requests.find((row) => row.url.endsWith('/posts'))
    expect(create).toBeDefined()
    const body = (await create!.clone().json()) as {
      type: string
      date: string
      posts: Array<{
        integration: { id: string }
        value: Array<{ image: Array<{ id: string; path: string }> }>
        settings: { __type: string }
      }>
    }
    expect(body.type).toBe('schedule')
    expect(body.date).toBe(scheduledAt.toISOString())
    expect(body.posts[0]?.integration.id).toBe('int_li')
    expect(body.posts[0]?.value[0]?.image[0]).toEqual({
      id: 'img-123',
      path: 'https://uploads.postiz.com/final.mp4',
    })
    expect(body.posts[0]?.settings.__type).toBe('linkedin')
    expect(JSON.stringify(body)).not.toContain(mockEnv.POSTIZ_API_KEY)
  })

  it('posts now and marks the Synawood row posted', async () => {
    const { client } = makeDb()
    const { fetchImpl, requests } = createMockPostizFetch()
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => bytes,
      now: () => now,
    })

    const result = await adapter.schedule({
      productId: 'demo',
      finalAssetId: 'fa_1',
      channel: 'linkedin_founder',
      caption: 'Now',
    })

    expect(result.record.postizId).toBe('pz_1')
    expect(result.record.status).toBe('posted')
    const create = requests.find((row) => row.url.endsWith('/posts'))
    const body = (await create!.clone().json()) as { type: string }
    expect(body.type).toBe('now')
  })

  it('does not create a second Postiz post when postiz_id is already set', async () => {
    const { client } = makeDb({
      existing: {
        id: 'pr_existing',
        product_id: 'demo',
        final_asset_id: 'fa_1',
        content_slot_id: null,
        channel: 'linkedin_founder',
        status: 'scheduled',
        caption: 'Hello founders',
        scheduled_at: scheduledAt.toISOString(),
        posted_at: null,
        external_url: null,
        postiz_id: 'pz_already',
        status_history: [],
        created_at: '2026-08-26T00:00:00.000Z',
        updated_at: '2026-08-26T00:00:00.000Z',
      },
    })
    let httpCalls = 0
    const fetchImpl: typeof fetch = async () => {
      httpCalls += 1
      return new Response('should not run', { status: 500 })
    }
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => bytes,
    })

    const result = await adapter.schedule(scheduleInput)
    expect(result.record.postizId).toBe('pz_already')
    expect(httpCalls).toBe(0)
  })

  it('rejects ads without calling Postiz', async () => {
    const { client } = makeDb()
    let httpCalls = 0
    const fetchImpl: typeof fetch = async () => {
      httpCalls += 1
      return new Response('should not run', { status: 500 })
    }
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => bytes,
    })

    await expect(
      adapter.schedule({
        productId: 'demo',
        finalAssetId: 'fa_1',
        channel: 'google_search_ads',
      }),
    ).rejects.toThrow(POSTIZ_TYPE_ADS_COPY)
    expect(httpCalls).toBe(0)
  })

  it('surfaces 429 as a recoverable failed schedule without echoing the API key', async () => {
    const { client, records } = makeDb()
    const { fetchImpl } = createMockPostizFetch({ createStatus: 429 })
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => bytes,
    })

    try {
      await adapter.schedule(scheduleInput)
      throw new Error('expected schedule to fail')
    } catch (error) {
      expect(String(error)).toMatch(/429/)
      expect(String(error)).not.toContain(mockEnv.POSTIZ_API_KEY)
      expect(records[0]?.status).toBe('failed')
    }
  })

  it('keeps the dashboard publish route on the manual adapter (Approve does not post)', () => {
    const route = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../../../dashboard/app/api/studio/publish/route.ts',
      ),
      'utf8',
    )
    expect(route).toContain('createManualPublishAdapter')
    expect(route).not.toContain('createPostizPublishAdapter')
  })
})
