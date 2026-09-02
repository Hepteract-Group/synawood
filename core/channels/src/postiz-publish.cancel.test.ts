import { describe, expect, it, vi } from 'vitest'
import { POSTED_CANCEL_COPY } from './manual-publish'
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

describe('createPostizPublishAdapter.cancel (#802)', () => {
  it('DELETEs the Postiz post and marks the Synawood row skipped', async () => {
    const client = makeClient(scheduledRow)
    const { fetchImpl, requests } = createMockPostizFetch()
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => Buffer.from('x'),
    })

    const result = await adapter.cancel('pr_1')
    expect(result.status).toBe('skipped')
    expect(requests[0]?.method).toBe('DELETE')
    expect(requests[0]?.url).toBe('https://api.postiz.com/public/v1/posts/pz_1')
  })

  it('treats 404 already-deleted as success and skips the Synawood row', async () => {
    const client = makeClient(scheduledRow)
    const { fetchImpl } = createMockPostizFetch({ deleteStatus: 404 })
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => Buffer.from('x'),
    })
    const result = await adapter.cancel('pr_1')
    expect(result.status).toBe('skipped')
  })

  it('does not silently delete a posted Postiz row', async () => {
    const client = makeClient({
      ...scheduledRow,
      status: 'posted',
      posted_at: '2026-08-26T13:00:00.000Z',
    })
    const { fetchImpl, requests } = createMockPostizFetch()
    const adapter = createPostizPublishAdapter(mockEnv, {
      supabase: client as never,
      fetchImpl,
      readBytes: async () => Buffer.from('x'),
    })
    await expect(adapter.cancel('pr_1')).rejects.toThrow(POSTED_CANCEL_COPY)
    expect(requests).toHaveLength(0)
  })
})
