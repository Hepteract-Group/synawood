import { describe, expect, it, vi } from 'vitest'
import { listGenerationJobsForProduct } from './enqueue'

describe('listGenerationJobsForProduct', () => {
  it('queries generation_jobs by product_id, newest first', async () => {
    const limit = vi.fn(async () => ({
      data: [
        {
          id: 'job-1',
          product_id: 'demo',
          project_id: 'proj-1',
          status: 'ready',
          role: 'extract',
          model_id: null,
          model_profile_id: null,
          estimated_gbp: 0.12,
          actual_gbp: 0.1,
          input_snapshot: {},
          output_asset_id: null,
          error_message: null,
          created_at: '2026-08-22T01:00:00.000Z',
        },
      ],
      error: null,
    }))
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))
    const jobs = await listGenerationJobsForProduct({ from } as never, { productId: 'demo' })
    expect(from).toHaveBeenCalledWith('generation_jobs')
    expect(eq).toHaveBeenCalledWith('product_id', 'demo')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.id).toBe('job-1')
  })
})
