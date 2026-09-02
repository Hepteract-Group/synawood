import { describe, expect, it, vi } from 'vitest'

vi.mock('../billing/gate.js', () => ({
  resolveCreativeSpendGate: vi.fn(),
}))

vi.mock('../generation-jobs/enqueue.js', () => ({
  enqueueGenerationJob: vi.fn(async () => ({
    id: 'job-1',
    input_snapshot: { skipPaidStages: false },
  })),
}))

vi.mock('./persist.js', () => ({
  upsertAssetIndexState: vi.fn(async () => ({
    assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: 'pending',
  })),
}))

vi.mock('./estimate-index.js', () => ({
  estimateAssetIndexGbp: vi.fn(() => ({ estimatedGbp: 0.05 })),
}))

import { resolveCreativeSpendGate } from '../billing/gate'
import { enqueueGenerationJob } from '../generation-jobs/enqueue'
import { enqueueAssetIndexJob } from './enqueue-index'

describe('enqueueAssetIndexJob metering (#457)', () => {
  it('fail-opens spent sums when allowUnconfirmedPaid and ledger read fails', async () => {
    vi.mocked(resolveCreativeSpendGate).mockRejectedValue(new Error('Failed to sum cost events'))

    const result = await enqueueAssetIndexJob({
      supabase: {} as never,
      productId: 'demo',
      projectId: '22222222-2222-4222-8222-222222222222',
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      allowUnconfirmedPaid: true,
    })

    expect(result.job.id).toBe('job-1')
    expect(enqueueGenerationJob).toHaveBeenCalled()
  })

  it('still throws metering errors when confirm is required', async () => {
    vi.mocked(resolveCreativeSpendGate).mockRejectedValue(new Error('Failed to sum cost events'))

    await expect(
      enqueueAssetIndexJob({
        supabase: {} as never,
        productId: 'demo',
        projectId: null,
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
    ).rejects.toThrow(/Failed to sum cost events/)
  })
})
