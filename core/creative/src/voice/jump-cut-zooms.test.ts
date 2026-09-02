import { describe, expect, it } from 'vitest'
import { addClip, attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { BROLL_TRACK_ID, MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import { applyCutList } from './apply-cut-list'
import { applyJumpCutZooms, JUMP_CUT_ZOOM_INTENSITY } from './jump-cut-zooms'

const talkingHead = () => {
  let project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  project = attachAsset(project, {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    kind: 'video',
    blobKey: 'local/take.mp4',
    source: 'upload',
    probe: {},
  })
  project = addClip(project, {
    assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    from: 0,
    durationInFrames: 180,
  })
  return project
}

describe('applyJumpCutZooms (#884)', () => {
  it('puts a zoom punch on a filler splice after the cut list is applied', () => {
    const project = talkingHead()
    const clipId = project.clips[0]!.id
    const cuts = [{ startMs: 1000, endMs: 1333, reason: 'filler' as const }]
    const cut = applyCutList(project, clipId, cuts)
    const next = applyJumpCutZooms(cut, { clipFrom: 0, cuts })
    const zoomed = next.clips.find((clip) =>
      clip.treatments?.some((item) => item.id === 'zoom_punch'),
    )
    expect(zoomed?.from).toBe(30)
    expect(zoomed?.treatments).toEqual([{ id: 'zoom_punch', intensity: JUMP_CUT_ZOOM_INTENSITY }])
    expect(next.whyLog.at(-1)?.reason).toBe('Added a small zoom so the jump does not flash.')
  })

  it('skips pause splices', () => {
    const project = talkingHead()
    const clipId = project.clips[0]!.id
    const cuts = [{ startMs: 1000, endMs: 1333, reason: 'pause' as const }]
    const cut = applyCutList(project, clipId, cuts)
    const next = applyJumpCutZooms(cut, { clipFrom: 0, cuts })
    expect(next.clips.every((clip) => !clip.treatments?.length)).toBe(true)
  })

  it('skips rambling splices', () => {
    const project = talkingHead()
    const clipId = project.clips[0]!.id
    const cuts = [{ startMs: 1000, endMs: 1333, reason: 'clarity' as const }]
    const cut = applyCutList(project, clipId, cuts)
    const next = applyJumpCutZooms(cut, { clipFrom: 0, cuts })
    expect(next.clips.every((clip) => !clip.treatments?.length)).toBe(true)
  })

  it('uses the original clip start, not zero, after a split', () => {
    let project = talkingHead()
    const firstId = project.clips[0]!.id
    project = {
      ...project,
      clips: project.clips.map((clip) => (clip.id === firstId ? { ...clip, from: 90 } : clip)),
    }
    const cuts = [{ startMs: 1000, endMs: 1333, reason: 'filler' as const }]
    const cut = applyCutList(project, firstId, cuts)
    const next = applyJumpCutZooms(cut, { clipFrom: 90, cuts })
    const zoomed = next.clips.find((clip) =>
      clip.treatments?.some((item) => item.id === 'zoom_punch'),
    )
    expect(zoomed?.from).toBe(120)
  })

  it('does not put a zoom punch on B-roll at the same splice frame (#939)', () => {
    let project = talkingHead()
    const clipId = project.clips[0]!.id
    project = addClip(project, {
      assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      from: 30,
      durationInFrames: 60,
      trackId: BROLL_TRACK_ID,
    })
    const cuts = [{ startMs: 1000, endMs: 1333, reason: 'filler' as const }]
    const cut = applyCutList(project, clipId, cuts)
    const next = applyJumpCutZooms(cut, { clipFrom: 0, cuts })
    const broll = next.clips.find((clip) => clip.trackId === BROLL_TRACK_ID)
    const main = next.clips.find(
      (clip) =>
        clip.trackId === MAIN_VIDEO_TRACK_ID &&
        clip.treatments?.some((item) => item.id === 'zoom_punch'),
    )
    expect(broll?.treatments?.some((item) => item.id === 'zoom_punch')).toBeFalsy()
    expect(main?.from).toBe(30)
  })
})
