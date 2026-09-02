import { describe, expect, it } from 'vitest'
import { listBackfillAssetIds } from './backfill-index'
import type { AssetIndexStatusItem } from './index-status'

const indexed = (
  assetId: string,
  status: AssetIndexStatusItem['status'] = 'ready',
): AssetIndexStatusItem => ({
  assetId,
  status,
  stage: status === 'ready' ? 'ready' : 'queued',
  lastError: null,
})

describe('listBackfillAssetIds (#584)', () => {
  it('includes assets with no index row', () => {
    expect(
      listBackfillAssetIds({
        assetIds: ['a', 'b'],
        assets: [
          { id: 'a', kind: 'video' },
          { id: 'b', kind: 'video' },
        ],
        indexed: [indexed('a')],
        shots: [{ assetId: 'a', thumbBlobKey: 'uploads/a/shot-0-thumb.jpg' }],
        visualAssetIds: ['a'],
      }),
    ).toEqual(['b'])
  })

  it('includes indexed video/image missing a shot thumb', () => {
    expect(
      listBackfillAssetIds({
        assetIds: ['vid'],
        assets: [{ id: 'vid', kind: 'video' }],
        indexed: [indexed('vid')],
        shots: [
          { assetId: 'vid', thumbBlobKey: 'uploads/vid/shot-0-thumb.jpg' },
          { assetId: 'vid', thumbBlobKey: null },
        ],
        visualAssetIds: ['vid'],
      }),
    ).toEqual(['vid'])
  })

  it('includes indexed video/image with no visual rows', () => {
    expect(
      listBackfillAssetIds({
        assetIds: ['still'],
        assets: [{ id: 'still', kind: 'image' }],
        indexed: [indexed('still')],
        shots: [{ assetId: 'still', thumbBlobKey: 'uploads/still/shot-0-thumb.jpg' }],
        visualAssetIds: [],
      }),
    ).toEqual(['still'])
  })

  it('includes indexed video with no shots yet', () => {
    expect(
      listBackfillAssetIds({
        assetIds: ['vid'],
        assets: [{ id: 'vid', kind: 'video' }],
        indexed: [indexed('vid')],
        shots: [],
        visualAssetIds: [],
      }),
    ).toEqual(['vid'])
  })

  it('skips audio even when thumbs and visual are missing', () => {
    expect(
      listBackfillAssetIds({
        assetIds: ['song'],
        assets: [{ id: 'song', kind: 'audio' }],
        indexed: [indexed('song')],
        shots: [],
        visualAssetIds: [],
      }),
    ).toEqual([])
  })

  it('skips in-flight index jobs', () => {
    expect(
      listBackfillAssetIds({
        assetIds: ['p', 'i'],
        assets: [
          { id: 'p', kind: 'video' },
          { id: 'i', kind: 'image' },
        ],
        indexed: [indexed('p', 'pending'), indexed('i', 'indexing')],
        shots: [],
        visualAssetIds: [],
      }),
    ).toEqual([])
  })

  it('skips complete video/image (thumbs + visual present)', () => {
    expect(
      listBackfillAssetIds({
        assetIds: ['ok'],
        assets: [{ id: 'ok', kind: 'video' }],
        indexed: [indexed('ok')],
        shots: [{ assetId: 'ok', thumbBlobKey: 'uploads/ok/shot-0-thumb.jpg' }],
        visualAssetIds: ['ok'],
      }),
    ).toEqual([])
  })

  it('includes ready rows marked visual embed skipped (pre-2J text-only)', () => {
    expect(
      listBackfillAssetIds({
        assetIds: ['old'],
        assets: [{ id: 'old', kind: 'video' }],
        indexed: [
          {
            assetId: 'old',
            status: 'ready',
            stage: 'ready',
            lastError: 'visual embed skipped: no keyframe thumbs yet (text embed only in v1)',
          },
        ],
        shots: [{ assetId: 'old', thumbBlobKey: null }],
        visualAssetIds: [],
      }),
    ).toEqual(['old'])
  })

  it('skips failed, thumbs-missing, and visual-failed rows (chip Retry)', () => {
    expect(
      listBackfillAssetIds({
        assetIds: ['bad', 'thumbs', 'vis'],
        assets: [
          { id: 'bad', kind: 'video' },
          { id: 'thumbs', kind: 'video' },
          { id: 'vis', kind: 'image' },
        ],
        indexed: [
          indexed('bad', 'failed'),
          {
            assetId: 'thumbs',
            status: 'ready',
            stage: 'ready',
            lastError: 'Keyframe thumbs missing: ffmpeg missing. Retry index.',
          },
          {
            assetId: 'vis',
            status: 'ready',
            stage: 'ready',
            lastError: 'visual embed failed: gateway 500',
          },
        ],
        shots: [
          { assetId: 'bad', thumbBlobKey: 'uploads/bad/shot-0-thumb.jpg' },
          { assetId: 'thumbs', thumbBlobKey: null },
          { assetId: 'vis', thumbBlobKey: 'uploads/vis/shot-0-thumb.jpg' },
        ],
        visualAssetIds: [],
      }),
    ).toEqual([])
  })
})
