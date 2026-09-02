import { describe, expect, it } from 'vitest'
import {
  addClip,
  attachAsset,
  createEmptyProject,
  fitDurationToContent,
  placeClip,
  setTrackFlags,
} from '../project/index'
import { assertProjectChanged, projectContentFingerprint } from './project-change'

describe('projectContentFingerprint', () => {
  it('ignores revision so identical content hashes equal', () => {
    const a = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const b = { ...a, revision: a.revision + 5 }
    expect(projectContentFingerprint(a)).toBe(projectContentFingerprint(b))
  })
})

describe('assertProjectChanged', () => {
  it('throws when place_clip keeps the same from', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const assetId = '11111111-1111-4111-8111-111111111111'
    project = attachAsset(project, {
      id: assetId,
      kind: 'video',
      blobKey: 'local/v.mp4',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    project = addClip(project, { assetId, from: 0, durationInFrames: 90 })
    const clipId = project.clips[0]!.id
    const next = placeClip(project, clipId, 0)
    expect(() => assertProjectChanged(project, next, 'place_clip')).toThrow(/nothing new to apply/i)
  })

  it('throws when fit_duration is already at content end', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const assetId = '11111111-1111-4111-8111-111111111111'
    project = attachAsset(project, {
      id: assetId,
      kind: 'video',
      blobKey: 'local/v.mp4',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    project = addClip(project, { assetId, from: 0, durationInFrames: 90 })
    // addClip auto-fits; bloating then fitting once leaves a second call as a no-op
    project = { ...project, durationFrames: 5_000, revision: project.revision }
    project = fitDurationToContent(project)
    expect(() => fitDurationToContent(project)).toThrow(/no change|already matches/i)
  })

  it('throws when set_track_flags repeats the same flags', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const trackId = project.tracks[0]!.id
    project = setTrackFlags(project, trackId, { locked: true })
    const again = setTrackFlags(project, trackId, { locked: true })
    expect(() => assertProjectChanged(project, again, 'set_track_flags')).toThrow(
      /nothing new to apply|no change/i,
    )
  })

  it('allows a real content change', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const assetId = '11111111-1111-4111-8111-111111111111'
    project = attachAsset(project, {
      id: assetId,
      kind: 'video',
      blobKey: 'local/v.mp4',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    const withClip = addClip(project, { assetId, from: 0, durationInFrames: 90 })
    expect(() => assertProjectChanged(project, withClip, 'add_clip')).not.toThrow()
  })
})
