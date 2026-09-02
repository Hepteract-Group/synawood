import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockPostizFetch } from './postiz-mock-http'
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

const makeClient = (row: Record<string, unknown>) => {
  const current = { ...row }
  return {
    current,
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: current, error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
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
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createPostizPublishAdapter.getStatus (#805)', () => {
  it('maps PUBLISHED + releaseURL to posted and persists posted_url', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const client = makeClient(scheduledRow)
    const { fetchImpl, requests } = createMockPostizFetch({
      listPosts: [
        {
          id: 'pz_1',
          state: 'PUBLISHED',
          releaseURL: 'https://x.com/demo/status/99',
        },
      ],
    })
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => Buffer.from('x'),
    })

    const result = await adapter.getStatus('pr_1')
    expect(result.status).toBe('posted')
    expect(result.postedUrl).toBe('https://x.com/demo/status/99')
    expect(client.current.external_url).toBe('https://x.com/demo/status/99')
    expect(client.current.status).toBe('posted')
    expect(requests[0]?.method).toBe('GET')
    expect(new URL(requests[0]!.url).pathname).toMatch(/\/posts$/)
    expect(spy).not.toHaveBeenCalled()
  })

  it('maps ERROR to failed without a live URL', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const client = makeClient(scheduledRow)
    const { fetchImpl } = createMockPostizFetch({
      listPosts: [{ id: 'pz_1', state: 'ERROR', releaseURL: null }],
    })
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => Buffer.from('x'),
    })
    const result = await adapter.getStatus('pr_1')
    expect(result.status).toBe('failed')
    expect(result.postedUrl).toBeNull()
    expect(client.current.status).toBe('failed')
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not overwrite a founder paste with empty poll', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const client = makeClient({
      ...scheduledRow,
      status: 'manual_posted',
      external_url: 'https://x.com/demo/status/pasted',
      posted_at: '2026-08-26T13:00:00.000Z',
    })
    const { fetchImpl, requests } = createMockPostizFetch({
      listPosts: [{ id: 'pz_1', state: 'PUBLISHED', releaseURL: '' }],
    })
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => Buffer.from('x'),
    })
    const result = await adapter.getStatus('pr_1')
    expect(result.status).toBe('manual_posted')
    expect(result.postedUrl).toBe('https://x.com/demo/status/pasted')
    expect(requests).toHaveLength(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not mark posted until releaseURL is present', async () => {
    const client = makeClient(scheduledRow)
    const { fetchImpl } = createMockPostizFetch({
      listPosts: [{ id: 'pz_1', state: 'PUBLISHED', releaseURL: '' }],
    })
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => Buffer.from('x'),
    })
    const result = await adapter.getStatus('pr_1')
    expect(result.status).toBe('scheduled')
    expect(result.postedUrl).toBeNull()
    expect(client.current.status).toBe('scheduled')
  })
})
