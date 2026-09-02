import { describe, expect, it, vi } from 'vitest'
import { markRenderJob } from './status'
import { hashWebhookSecret } from '../webhooks/sign'

const jobRow = {
  id: 'render-1',
  product_id: 'demo',
  project_id: 'proj-1',
  status: 'completed',
  output_asset_ids: [],
  duration_ms: 12,
  error_message: null,
  created_at: '2026-08-29T00:00:00.000Z',
  updated_at: '2026-08-29T00:00:00.000Z',
}

describe('markRenderJob webhook enqueue (#1079)', () => {
  it('maps completed to job.ready and enqueues a pending delivery', async () => {
    const inserts: Record<string, unknown>[] = []
    const from = vi.fn((table: string) => {
      if (table === 'render_jobs') {
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: jobRow, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'product_webhooks') {
        return {
          select: () => ({
            eq: () => ({
              is: async () => ({
                data: [
                  {
                    id: 'wh-1',
                    events: ['job.ready', 'job.failed'],
                    revoked_at: null,
                    secret_hash: hashWebhookSecret('whsec_fixture_test_secret'),
                  },
                ],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'webhook_deliveries') {
        return {
          insert: (row: Record<string, unknown>) => {
            inserts.push(row)
            return Promise.resolve({ data: row, error: null })
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    })
    await markRenderJob({ from } as never, 'render-1', { status: 'completed' })
    expect(inserts).toHaveLength(1)
    expect(inserts[0]?.event).toBe('job.ready')
    expect(inserts[0]?.status).toBe('pending')
  })
})
