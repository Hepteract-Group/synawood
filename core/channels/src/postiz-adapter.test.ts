import { afterEach, describe, expect, it, vi } from 'vitest'
import { POSTED_CANCEL_COPY } from './manual-publish'
import { createMockPostizFetch } from './postiz-mock-http'
import { createPostizPublishAdapter } from './postiz-publish'
import { POSTIZ_TYPE_ADS_COPY } from './postiz-settings-type'
import { uploadPostizMedia } from './postiz-upload'

const bytes = Buffer.from('fake-mp4-bytes')
const mockEnv = {
  POSTIZ_ADAPTER: 'mock',
  POSTIZ_BASE_URL: 'https://api.postiz.com/public/v1',
  POSTIZ_API_KEY: 'pos_secret_do_not_log',
}

type FakeRow = Record<string, unknown>

const makeScheduleDb = (channel: string) => {
  const records: FakeRow[] = []
  const binding = {
    id: 'bind_1',
    product_id: 'demo',
    channel,
    postiz_integration_id: 'int_1',
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
  }
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
              maybeSingle: async () => ({ data: { status: 'approved' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'asset_final',
                  blob_key: 'products/demo/finals/ad.mp4',
                  content_type: 'video/mp4',
                  kind: 'video',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'product_channel_integrations') {
        const qb = {
          select: () => qb,
          eq: () => qb,
          order: () => qb,
          then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
            resolve({ data: [binding], error: null }),
        }
        return qb
      }
      const filters: FakeRow = {}
      const qb = {
        select: () => qb,
        eq: (col: string, value: string) => {
          filters[col] = value
          return qb
        },
        order: () => qb,
        insert: (row: FakeRow) => {
          const full = {
            posted_at: null,
            external_url: null,
            content_slot_id: null,
            caption: null,
            scheduled_at: null,
            ...row,
          }
          records.push(full)
          return { select: () => ({ single: async () => ({ data: full, error: null }) }) }
        },
        update: (patch: FakeRow) => ({
          eq: (col: string, value: string) => {
            const match = records.find((row) => row[col] === value)
            if (match) Object.assign(match, patch)
            return {
              select: () => ({ single: async () => ({ data: match ?? null, error: null }) }),
            }
          },
        }),
        then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
          resolve({
            data: records.filter((row) =>
              Object.entries(filters).every(([col, value]) => row[col] === value),
            ),
            error: null,
          }),
      }
      return qb
    }),
  }
  return { client, records }
}

describe('Postiz adapter unit tests (#804)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('schedules X and TikTok through mock HTTP and persists postiz_id', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    for (const channel of ['x_founder', 'tiktok_organic'] as const) {
      const { client, records } = makeScheduleDb(channel)
      const { fetchImpl, requests } = createMockPostizFetch()
      const adapter = createPostizPublishAdapter(mockEnv, {
        supabase: client as never,
        fetchImpl,
        readBytes: async () => bytes,
      })
      const result = await adapter.schedule({
        productId: 'demo',
        finalAssetId: 'fa_1',
        channel,
        scheduledAt: new Date('2026-08-27T10:00:00.000Z'),
      })
      expect(result.record.postizId).toBe('pz_1')
      expect(records[0]?.postiz_id).toBe('pz_1')
      const create = requests.find((row) => row.method === 'POST' && /\/posts$/.test(row.url))
      const body = (await create!.clone().json()) as {
        posts: Array<{ settings: { __type: string } }>
      }
      expect(body.posts[0]?.settings.__type).toBe(channel === 'x_founder' ? 'x' : 'tiktok')
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects ads without HTTP', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const { client } = makeScheduleDb('linkedin_founder')
    const { fetchImpl, requests } = createMockPostizFetch()
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => bytes,
    })
    await expect(
      adapter.schedule({
        productId: 'demo',
        finalAssetId: 'fa_1',
        channel: 'linkedin_ads',
      }),
    ).rejects.toThrow(POSTIZ_TYPE_ADS_COPY)
    expect(requests).toHaveLength(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it('uploads multipart bytes through the mock, not base64', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const { fetchImpl, requests } = createMockPostizFetch()
    await uploadPostizMedia({
      bytes,
      filename: 'final.mp4',
      contentType: 'video/mp4',
      baseUrl: mockEnv.POSTIZ_BASE_URL,
      apiKey: mockEnv.POSTIZ_API_KEY,
      fetchImpl,
    })
    const upload = requests[0]
    expect(upload?.url).toMatch(/\/upload$/)
    expect(upload?.url).not.toMatch(/upload-from-url/)
    const file = (await upload!.clone().formData()).get('file') as File
    expect(file).toBeInstanceOf(File)
    expect(Buffer.from(await file.arrayBuffer()).equals(bytes)).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('cancels a scheduled post through mock DELETE', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const current: FakeRow = {
      id: 'pr_1',
      product_id: 'demo',
      final_asset_id: 'fa_1',
      content_slot_id: null,
      channel: 'x_founder',
      status: 'scheduled',
      caption: null,
      scheduled_at: '2026-08-27T10:00:00.000Z',
      posted_at: null,
      external_url: null,
      postiz_id: 'pz_1',
      status_history: [],
      created_at: '2026-08-26T12:00:00.000Z',
      updated_at: '2026-08-26T12:00:00.000Z',
    }
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: current, error: null }),
          }),
        }),
        update: (patch: FakeRow) => {
          Object.assign(current, patch)
          return {
            eq: () => ({
              select: () => ({
                single: async () => ({ data: current, error: null }),
              }),
            }),
          }
        },
      })),
    }
    const { fetchImpl, requests } = createMockPostizFetch()
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => bytes,
    })
    const result = await adapter.cancel('pr_1')
    expect(result.status).toBe('skipped')
    expect(requests[0]?.method).toBe('DELETE')
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not silently cancel a posted row', async () => {
    const current: FakeRow = {
      id: 'pr_1',
      product_id: 'demo',
      final_asset_id: 'fa_1',
      content_slot_id: null,
      channel: 'x_founder',
      status: 'posted',
      caption: null,
      scheduled_at: null,
      posted_at: '2026-08-26T13:00:00.000Z',
      external_url: 'https://x.com/demo/status/1',
      postiz_id: 'pz_1',
      status_history: [],
      created_at: '2026-08-26T12:00:00.000Z',
      updated_at: '2026-08-26T13:00:00.000Z',
    }
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: current, error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: current, error: null }),
            }),
          }),
        }),
      })),
    }
    const spy = vi.spyOn(globalThis, 'fetch')
    const { fetchImpl, requests } = createMockPostizFetch()
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => bytes,
    })
    await expect(adapter.cancel('pr_1')).rejects.toThrow(POSTED_CANCEL_COPY)
    expect(requests).toHaveLength(0)
    expect(spy).not.toHaveBeenCalled()
  })
})
