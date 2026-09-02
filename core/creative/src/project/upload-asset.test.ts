import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from './schema'

vi.mock('../persistence/blob.js', () => ({
  putBlob: vi.fn(async () => ({ blobKey: 'local/marketing-os/demo/uploads/p/a.mp4' })),
  deleteBlob: vi.fn(async () => undefined),
}))

vi.mock('./load.js', () => ({
  loadProject: vi.fn(async () => ({
    project: createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    }),
    row: {},
  })),
}))

vi.mock('./save.js', () => ({
  saveProject: vi.fn(async () => {
    throw new Error('save failed')
  }),
}))

vi.mock('../asset-intelligence/enqueue-index.js', () => ({
  enqueueAssetIndexJob: vi.fn(async () => ({ job: { id: 'job-1' } })),
}))

vi.mock('../asset-intelligence/run-index.js', () => ({
  runAssetIndexJob: vi.fn(async () => undefined),
}))

import { deleteBlob, putBlob } from '../persistence/blob'
import { enqueueAssetIndexJob } from '../asset-intelligence/enqueue-index'
import { saveProject } from './save'
import { uploadProjectAsset } from './upload-asset'

describe('uploadProjectAsset compensation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes Blob and asset row when project save fails', async () => {
    vi.mocked(saveProject).mockRejectedValueOnce(new Error('save failed'))
    const deleteEq = vi.fn(async () => ({ error: null }))
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'assets') {
          return {
            insert: vi.fn(async () => ({ error: null })),
            delete: vi.fn(() => ({ eq: deleteEq })),
          }
        }
        return {}
      }),
    }

    await expect(
      uploadProjectAsset({
        supabase: supabase as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'marketing-os',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        projectId: '22222222-2222-4222-8222-222222222222',
        expectedRevision: 1,
        fileName: 'take.mp4',
        contentType: 'video/mp4',
        data: Buffer.from('fake'),
      }),
    ).rejects.toThrow(/save failed/)

    expect(putBlob).toHaveBeenCalled()
    expect(deleteBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        blobKey: 'local/marketing-os/demo/uploads/p/a.mp4',
      }),
    )
    expect(deleteEq).toHaveBeenCalled()
  })

  it('keeps the upload when index enqueue fails after save (#457)', async () => {
    vi.mocked(saveProject).mockResolvedValueOnce({
      project: createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
      }),
    } as never)
    vi.mocked(enqueueAssetIndexJob).mockRejectedValueOnce(new Error('Failed to sum cost events'))
    const deleteEq = vi.fn(async () => ({ error: null }))
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'assets') {
          return {
            insert: vi.fn(async () => ({ error: null })),
            delete: vi.fn(() => ({ eq: deleteEq })),
          }
        }
        return {}
      }),
    }

    const result = await uploadProjectAsset({
      supabase: supabase as never,
      blobEnv: {
        connectionString: 'x',
        containerName: 'marketing-os',
        useLocalPrefix: true,
        accountName: 'a',
        accountKey: 'k',
      },
      projectId: '22222222-2222-4222-8222-222222222222',
      expectedRevision: 1,
      fileName: 'take.mp4',
      contentType: 'video/mp4',
      data: Buffer.from('fake'),
    })

    expect(result.asset.id).toBeTruthy()
    expect(deleteEq).not.toHaveBeenCalled()
    expect(deleteBlob).not.toHaveBeenCalled()
  })
})
