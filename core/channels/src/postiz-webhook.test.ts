import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ingestPostizWebhook,
  POSTIZ_WEBHOOK_BAD_SECRET_COPY,
  POSTIZ_WEBHOOK_NOT_CONFIGURED_COPY,
} from './postiz-webhook'

const secret = 'whsec_test_do_not_log'
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

const publishedBody = JSON.stringify({
  id: 'pz_1',
  state: 'PUBLISHED',
  releaseURL: 'https://x.com/demo/status/99',
})

const makeClient = (row: Record<string, unknown> | null) => {
  const current = row ? { ...row } : null
  return {
    current,
    from: vi.fn(() => ({
      select: () => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => ({
            data: current && current.postiz_id === value ? current : null,
            error: null,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        if (current) Object.assign(current, patch)
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

describe('ingestPostizWebhook (#806)', () => {
  it('rejects a bad secret', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const client = makeClient(scheduledRow)
    await expect(
      ingestPostizWebhook({
        supabase: client as never,
        env: { POSTIZ_WEBHOOK_SECRET: secret },
        header: 'wrong',
        rawBody: publishedBody,
      }),
    ).rejects.toThrow(POSTIZ_WEBHOOK_BAD_SECRET_COPY)
    expect(client.current?.status).toBe('scheduled')
    expect(spy).not.toHaveBeenCalled()
  })

  it('applies PUBLISHED once and is idempotent on duplicate delivery', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const client = makeClient(scheduledRow)
    const first = await ingestPostizWebhook({
      supabase: client as never,
      env: { POSTIZ_WEBHOOK_SECRET: secret },
      header: secret,
      rawBody: publishedBody,
    })
    const second = await ingestPostizWebhook({
      supabase: client as never,
      env: { POSTIZ_WEBHOOK_SECRET: secret },
      header: secret,
      rawBody: publishedBody,
    })
    expect(first.status).toBe('posted')
    expect(first.postedUrl).toBe('https://x.com/demo/status/99')
    expect(second.ignored).toBe('unchanged')
    expect(second.postedUrl).toBe('https://x.com/demo/status/99')
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns 2xx ignored for an unknown postiz_id', async () => {
    const client = makeClient(null)
    const result = await ingestPostizWebhook({
      supabase: client as never,
      env: { POSTIZ_WEBHOOK_SECRET: secret },
      header: secret,
      rawBody: publishedBody,
    })
    expect(result).toEqual({ ok: true, ignored: 'unknown_postiz_id' })
  })

  it('does not ingest when the secret is unset (poll remains recovery)', async () => {
    const client = makeClient(scheduledRow)
    await expect(
      ingestPostizWebhook({
        supabase: client as never,
        env: {},
        header: secret,
        rawBody: publishedBody,
      }),
    ).rejects.toThrow(POSTIZ_WEBHOOK_NOT_CONFIGURED_COPY)
    expect(client.current?.status).toBe('scheduled')
  })

  it('does not overwrite a founder paste', async () => {
    const client = makeClient({
      ...scheduledRow,
      status: 'manual_posted',
      external_url: 'https://x.com/demo/status/pasted',
    })
    const result = await ingestPostizWebhook({
      supabase: client as never,
      env: { POSTIZ_WEBHOOK_SECRET: secret },
      header: secret,
      rawBody: publishedBody,
    })
    expect(result.ignored).toBe('manual_posted')
    expect(client.current?.external_url).toBe('https://x.com/demo/status/pasted')
  })
})
