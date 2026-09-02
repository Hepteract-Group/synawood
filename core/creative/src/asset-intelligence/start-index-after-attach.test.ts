import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./enqueue-index.js', () => ({
  enqueueAssetIndexJob: vi.fn(),
}))

vi.mock('./run-index.js', () => ({
  runAssetIndexJob: vi.fn(async () => undefined),
}))

import { enqueueAssetIndexJob } from './enqueue-index'
import { runAssetIndexJob } from './run-index'
import { startAssetIndexAfterAttach } from './start-index-after-attach'

const blobEnv = {
  connectionString: 'x',
  containerName: 'marketing-os',
  useLocalPrefix: true,
  accountName: 'a',
  accountKey: 'k',
}

describe('startAssetIndexAfterAttach (#525)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enqueues index with unconfirmed paid allowed and starts the runner', async () => {
    vi.mocked(enqueueAssetIndexJob).mockResolvedValueOnce({
      job: { id: 'job-1', input_snapshot: { skipPaidStages: false } },
    } as never)

    await startAssetIndexAfterAttach({
      supabase: {} as never,
      blobEnv,
      productId: 'demo',
      projectId: '22222222-2222-4222-8222-222222222222',
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      modelProfileId: 'studio-default',
      source: 'generated',
    })

    expect(enqueueAssetIndexJob).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        allowUnconfirmedPaid: true,
        modelProfileId: 'studio-default',
      }),
    )
    expect(runAssetIndexJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        skipPaidStages: false,
        modelProfileId: 'studio-default',
      }),
    )
  })

  it('swallows enqueue failures so attach stays intact', async () => {
    vi.mocked(enqueueAssetIndexJob).mockRejectedValueOnce(new Error('Failed to sum cost events'))

    await expect(
      startAssetIndexAfterAttach({
        supabase: {} as never,
        blobEnv,
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        source: 'generated',
      }),
    ).resolves.toBeUndefined()

    expect(runAssetIndexJob).not.toHaveBeenCalled()
  })
})
