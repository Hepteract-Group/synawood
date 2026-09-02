import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../persistence/blob.js', () => ({
  putBlob: vi.fn(async () => ({ blobKey: 'local/marketing-os/demo/generated/p/video/a.mp4' })),
}))

vi.mock('../asset-intelligence/start-index-after-attach.js', () => ({
  startAssetIndexAfterAttach: vi.fn(async () => undefined),
}))

import { putBlob } from '../persistence/blob'
import { startAssetIndexAfterAttach } from '../asset-intelligence/start-index-after-attach'
import { persistGeneratedAsset } from './run'

const blobEnv = {
  connectionString: 'x',
  containerName: 'marketing-os',
  useLocalPrefix: true,
  accountName: 'a',
  accountKey: 'k',
}

const insertAssets = () =>
  ({
    from: vi.fn((table: string) => {
      if (table === 'assets') {
        return { insert: vi.fn(async () => ({ error: null })) }
      }
      return {}
    }),
  }) as never

describe('persistGeneratedAsset index enqueue (#525)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts index after a generated video is saved', async () => {
    const saved = await persistGeneratedAsset({
      supabase: insertAssets(),
      blobEnv,
      productId: 'demo',
      projectId: '22222222-2222-4222-8222-222222222222',
      role: 'video',
      modelProfileId: 'studio-default',
      asset: {
        kind: 'video',
        bytes: new Uint8Array([1, 2, 3]),
        contentType: 'video/mp4',
        probe: { durationSeconds: 8 },
      },
    })

    expect(putBlob).toHaveBeenCalled()
    expect(startAssetIndexAfterAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'demo',
        projectId: '22222222-2222-4222-8222-222222222222',
        assetId: saved.assetId,
        modelProfileId: 'studio-default',
      }),
    )
  })

  it('does not start index for generated stills', async () => {
    await persistGeneratedAsset({
      supabase: insertAssets(),
      blobEnv,
      productId: 'demo',
      projectId: '22222222-2222-4222-8222-222222222222',
      role: 'image',
      asset: {
        kind: 'image',
        bytes: new Uint8Array([1, 2, 3]),
        contentType: 'image/png',
        probe: {},
      },
    })

    expect(startAssetIndexAfterAttach).not.toHaveBeenCalled()
  })

  it('still returns the asset when index start fails', async () => {
    vi.mocked(startAssetIndexAfterAttach).mockRejectedValueOnce(new Error('index down'))

    const saved = await persistGeneratedAsset({
      supabase: insertAssets(),
      blobEnv,
      productId: 'demo',
      projectId: '22222222-2222-4222-8222-222222222222',
      role: 'video',
      asset: {
        kind: 'video',
        bytes: new Uint8Array([1, 2, 3]),
        contentType: 'video/mp4',
        probe: { durationSeconds: 4 },
      },
    })

    expect(saved.assetId).toMatch(/^[0-9a-f-]{36}$/)
  })
})
