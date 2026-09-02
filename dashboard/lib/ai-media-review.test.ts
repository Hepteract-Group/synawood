import { describe, expect, it } from 'vitest'
import {
  jobCanPlace,
  playableJobKind,
  previewUrlForJob,
  retryNeedsConfirm,
  studioHrefForJob,
} from './ai-media-review'

describe('AI Media review helpers (#783 / ADR-0062)', () => {
  it('builds a same-origin preview URL only when the job has a project still', () => {
    expect(
      previewUrlForJob({
        projectId: 'proj-1',
        outputAssetId: 'asset-1',
      }),
    ).toBe('/api/studio/projects/proj-1/assets/asset-1/content')
    expect(previewUrlForJob({ projectId: null, outputAssetId: 'asset-1' })).toBeNull()
    expect(playableJobKind('image')).toBe(true)
    expect(playableJobKind('extract')).toBe(false)
  })

  it('lets Place run on a ready file even when the job has no Studio project', () => {
    expect(jobCanPlace({ status: 'ready', outputAssetId: 'asset-1' })).toBe(true)
    expect(jobCanPlace({ status: 'ready', outputAssetId: null })).toBe(false)
    expect(jobCanPlace({ status: 'failed', outputAssetId: 'asset-1' })).toBe(false)
    expect(studioHrefForJob('proj-1')).toBe('/studio/proj-1')
    expect(studioHrefForJob(null)).toBe('/studio')
  })

  it('asks for spend confirm when a retry would cost more than £0', () => {
    expect(retryNeedsConfirm(0)).toBe(false)
    expect(retryNeedsConfirm(null)).toBe(false)
    expect(retryNeedsConfirm(0.12)).toBe(true)
  })
})
