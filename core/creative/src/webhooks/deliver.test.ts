import { describe, expect, it, vi } from 'vitest'
import {
  WEBHOOK_MAX_ATTEMPTS,
  applyDeliveryAttempt,
  deliverDueWebhookDeliveries,
  isDeliveryDue,
} from './deliver'

const now = new Date('2026-08-29T10:00:00.000Z')

const pendingRow = {
  id: 'del-1',
  webhook_id: 'wh-1',
  event: 'job.ready',
  payload: {
    event: 'job.ready',
    productId: 'demo',
    jobKind: 'generation' as const,
    jobId: 'job-1',
    status: 'ready' as const,
    signature: 'sha256=abc',
  },
  status: 'pending' as const,
  attempt_count: 0,
  last_error: null,
  next_attempt_at: null,
  product_webhooks: { url: 'https://example.test/hooks/ready', revoked_at: null },
}

const mockSupabase = (rows: Array<typeof pendingRow>) => {
  const store = rows.map((row) => ({ ...row }))
  const from = vi.fn((table: string) => {
    if (table !== 'webhook_deliveries') throw new Error(`unexpected table ${table}`)
    return {
      select: () => ({
        eq: async () => ({ data: store, error: null }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          const row = store.find((item) => item.id === id)
          if (row) Object.assign(row, patch)
          return { data: row, error: null }
        },
      }),
    }
  })
  return { from, store }
}

describe('webhook delivery worker (#1080)', () => {
  it('treats a due pending row as deliverable', () => {
    expect(isDeliveryDue(pendingRow, now)).toBe(true)
    expect(isDeliveryDue({ ...pendingRow, next_attempt_at: '2026-08-29T10:01:00.000Z' }, now)).toBe(
      false,
    )
  })

  it('marks delivered on HTTP 200', async () => {
    const { from, store } = mockSupabase([pendingRow])
    const post = vi.fn(async () => ({ status: 200 }))
    const result = await deliverDueWebhookDeliveries({
      supabase: { from } as never,
      post,
      now,
    })
    expect(post).toHaveBeenCalledWith({
      url: 'https://example.test/hooks/ready',
      body: JSON.stringify(pendingRow.payload),
      headers: {
        'content-type': 'application/json',
        'x-mos-signature': 'sha256=abc',
      },
    })
    expect(result).toEqual({ delivered: 1, retried: 0, failed: 0 })
    expect(store[0]?.status).toBe('delivered')
  })

  it('retries HTTP 500 then marks failed at the attempt cap', () => {
    const first = applyDeliveryAttempt({
      attemptCount: 0,
      ok: false,
      error: 'HTTP 500',
      now,
    })
    expect(first.status).toBe('pending')
    expect(first.attempt_count).toBe(1)
    expect(first.next_attempt_at).toBe('2026-08-29T10:00:30.000Z')

    const last = applyDeliveryAttempt({
      attemptCount: WEBHOOK_MAX_ATTEMPTS - 1,
      ok: false,
      error: 'HTTP 500',
      now,
    })
    expect(last.status).toBe('failed')
    expect(last.attempt_count).toBe(WEBHOOK_MAX_ATTEMPTS)
    expect(last.next_attempt_at).toBeNull()
  })

  it('marks failed after a fixture 500 at the last attempt without posting to a customer host', async () => {
    const { from, store } = mockSupabase([
      { ...pendingRow, attempt_count: WEBHOOK_MAX_ATTEMPTS - 1 },
    ])
    const post = vi.fn(async () => ({ status: 500 }))
    const result = await deliverDueWebhookDeliveries({
      supabase: { from } as never,
      post,
      now,
    })
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.test/hooks/ready' }),
    )
    expect(JSON.stringify(post.mock.calls)).not.toMatch(/customer|hepteract|demo/i)
    expect(result).toEqual({ delivered: 0, retried: 0, failed: 1 })
    expect(store[0]?.status).toBe('failed')
    expect(store[0]?.last_error).toBe('HTTP 500')
  })
})
