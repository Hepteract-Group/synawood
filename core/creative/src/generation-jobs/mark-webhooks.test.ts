import { describe, expect, it, vi } from 'vitest'
import { markGenerationJob } from './enqueue'
import { hashWebhookSecret } from '../webhooks/sign'

const jobRow = {
  id: 'job-1',
  product_id: 'demo',
  project_id: 'proj-1',
  status: 'ready',
  role: 'image',
  model_id: null,
  model_profile_id: null,
  estimated_gbp: 0,
  actual_gbp: 0,
  input_snapshot: {},
  output_asset_id: null,
  error_message: null,
}

describe('markGenerationJob webhook enqueue (#1079)', () => {
  it('creates a pending delivery when status becomes ready', async () => {
    const inserts: Record<string, unknown>[] = []
    const from = vi.fn((table: string) => {
      if (table === 'generation_jobs') {
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
                    events: ['job.ready'],
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
    await markGenerationJob({ from } as never, 'job-1', { status: 'ready' })
    expect(inserts).toHaveLength(1)
    expect(inserts[0]?.event).toBe('job.ready')
    expect(inserts[0]?.status).toBe('pending')
  })
})
