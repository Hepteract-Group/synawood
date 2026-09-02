import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockPostizFetch } from './postiz-mock-http'
import { runPostizPollJob } from './postiz-poll-worker'
import { createPostizPublishAdapter } from './postiz-publish'

const mockEnv = {
  POSTIZ_ADAPTER: 'mock',
  POSTIZ_BASE_URL: 'https://api.postiz.com/public/v1',
  POSTIZ_API_KEY: 'pos_secret_do_not_log',
}

const scheduledRow = {
  id: 'pr_1',
  product_id: 'demo',
  final_asset_id: 'fa_1',
  content_slot_id: null,
  channel: 'linkedin_founder',
  status: 'scheduled',
  caption: 'Hello',
  scheduled_at: '2026-08-27T10:00:00.000Z',
  posted_at: null,
  external_url: null,
  postiz_id: 'pz_1',
  status_history: [{ status: 'scheduled', at: '2026-08-26T12:00:00.000Z' }],
  created_at: '2026-08-26T12:00:00.000Z',
  updated_at: '2026-08-26T12:00:00.000Z',
}

const pastedRow = {
  ...scheduledRow,
  id: 'pr_paste',
  status: 'manual_posted',
  external_url: 'https://x.com/demo/status/pasted',
  posted_at: '2026-08-26T13:00:00.000Z',
  postiz_id: 'pz_paste',
}

const makeClient = (rows: Record<string, unknown>[]) => {
  const store = new Map(rows.map((row) => [row.id as string, { ...row }]))
  return {
    store,
    from: vi.fn(() => ({
      select: () => ({
        not: () => ({
          in: async () => ({
            data: [...store.values()].filter(
              (row) => row.status === 'scheduled' || row.status === 'posted',
            ),
            error: null,
          }),
        }),
        eq: (column: string, value: string) => ({
          maybeSingle: async () => ({
            data: column === 'id' ? (store.get(value) ?? null) : null,
            error: null,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: (column: string, value: string) => {
          const current = store.get(value)
          if (current && column === 'id') Object.assign(current, patch)
          return {
            select: () => ({
              single: async () => ({ data: current ?? null, error: null }),
            }),
          }
        },
      }),
    })),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runPostizPollJob (#805)', () => {
  it('writes posted_url from a mock PUBLISHED payload and skips paste rows', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const client = makeClient([scheduledRow, pastedRow])
    const { fetchImpl, requests } = createMockPostizFetch({
      listPosts: [
        { id: 'pz_1', state: 'PUBLISHED', releaseURL: 'https://x.com/demo/status/99' },
        { id: 'pz_paste', state: 'PUBLISHED', releaseURL: 'https://x.com/demo/status/other' },
      ],
    })
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => Buffer.from('x'),
    })

    const result = await runPostizPollJob({ supabase: client as never, adapter })
    expect(result.polled).toBe(1)
    expect(result.results[0]?.postedUrl).toBe('https://x.com/demo/status/99')
    expect(client.store.get('pr_1')?.status).toBe('posted')
    expect(client.store.get('pr_paste')?.external_url).toBe('https://x.com/demo/status/pasted')
    expect(requests.every((request) => request.method === 'GET')).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('keeps polling other rows when one getStatus throws', async () => {
    const client = makeClient([scheduledRow])
    const adapter = {
      getStatus: async () => {
        throw new Error('list-posts 500')
      },
    }
    const result = await runPostizPollJob({ supabase: client as never, adapter })
    expect(result.polled).toBe(0)
    expect(result.errors).toEqual([{ id: 'pr_1' }])
    expect(client.store.get('pr_1')?.status).toBe('scheduled')
  })
})
