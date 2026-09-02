import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { enqueueJobWebhookDeliveries } from './enqueue'
import { hashWebhookSecret, stringifyJobWebhookPayload } from './sign'

const FIXTURE_SECRET = 'whsec_fixture_test_secret'

const subscribedWebhook = {
  id: 'wh-1',
  events: ['job.ready', 'job.failed'],
  revoked_at: null,
  secret_hash: hashWebhookSecret(FIXTURE_SECRET),
}

const readyOnlyWebhook = {
  id: 'wh-ready',
  events: ['job.ready'],
  revoked_at: null,
  secret_hash: hashWebhookSecret(FIXTURE_SECRET),
}

const mockSupabase = (webhooks: (typeof subscribedWebhook)[]) => {
  const inserts: Record<string, unknown>[] = []
  const from = vi.fn((table: string) => {
    if (table === 'product_webhooks') {
      return {
        select: () => ({
          eq: () => ({
            is: async () => ({ data: webhooks, error: null }),
          }),
        }),
      }
    }
    if (table === 'webhook_deliveries') {
      return {
        insert: (row: Record<string, unknown>) => {
          inserts.push(row)
          return Promise.resolve({ data: { id: `del-${inserts.length}`, ...row }, error: null })
        },
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
  return { from, inserts }
}

describe('enqueueJobWebhookDeliveries (#1079)', () => {
  it('creates a pending delivery for job.ready with a verifiable signature', async () => {
    const { from, inserts } = mockSupabase([subscribedWebhook])
    const rows = await enqueueJobWebhookDeliveries({
      supabase: { from } as never,
      productId: 'demo',
      jobId: 'job-1',
      jobKind: 'generation',
      event: 'job.ready',
    })
    expect(from).toHaveBeenCalledWith('product_webhooks')
    expect(from).toHaveBeenCalledWith('webhook_deliveries')
    expect(rows).toHaveLength(1)
    expect(inserts[0]).toMatchObject({
      webhook_id: 'wh-1',
      event: 'job.ready',
      status: 'pending',
      attempt_count: 0,
    })
    const payload = inserts[0]?.payload as {
      event: string
      signature: string
      jobId: string
    }
    const body = stringifyJobWebhookPayload({
      event: 'job.ready',
      productId: 'demo',
      jobKind: 'generation',
      jobId: 'job-1',
      status: 'ready',
    })
    const expected = `sha256=${createHmac('sha256', subscribedWebhook.secret_hash).update(body, 'utf8').digest('hex')}`
    expect(payload.signature).toBe(expected)
    expect(payload.jobId).toBe('job-1')
  })

  it('does not enqueue unsubscribed events', async () => {
    const { from, inserts } = mockSupabase([readyOnlyWebhook])
    const rows = await enqueueJobWebhookDeliveries({
      supabase: { from } as never,
      productId: 'demo',
      jobId: 'job-2',
      jobKind: 'render',
      event: 'job.failed',
    })
    expect(from).toHaveBeenCalledWith('product_webhooks')
    expect(from).not.toHaveBeenCalledWith('webhook_deliveries')
    expect(rows).toEqual([])
    expect(inserts).toEqual([])
  })
})
