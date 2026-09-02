/** #514 — Shot window → clip trim/duration (30fps worked example). */

import { describe, expect, it } from 'vitest'
import { addClip, attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { BROLL_TRACK_ID, MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import { placeShotOnProject, shotWindowToClipTiming } from './place-shot'

const assetId = '11111111-1111-4111-8111-111111111111'

const withVideo = () => {
  const project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  return attachAsset(project, {
    id: assetId,
    kind: 'video',
    blobKey: 'local/marketing-os/demo/uploads/take.mp4',
    source: 'upload',
    probe: { durationFrames: 1200 },
  })
}

describe('shotWindowToClipTiming (#514)', () => {
  it('maps a 2s shot at 8s into a 40s take to trim 240f and duration 60f at 30fps', () => {
    expect(
      shotWindowToClipTiming({
        startMs: 8_000,
        endMs: 10_000,
        fps: 30,
      }),
    ).toEqual({ trimStartFrames: 240, durationInFrames: 60 })
  })

  it('uses fallback duration when endMs is null (still / open shot)', () => {
    expect(
      shotWindowToClipTiming({
        startMs: 0,
        endMs: null,
        fps: 30,
        fallbackDurationFrames: 90,
      }),
    ).toEqual({ trimStartFrames: 0, durationInFrames: 90 })
  })
})

describe('placeShotOnProject (#514)', () => {
  it('reroutes overlay onto main when main has no picture yet', () => {
    const next = placeShotOnProject(withVideo(), {
      assetId,
      startMs: 8_000,
      endMs: 10_000,
      trackId: 'broll',
      from: 0,
    })
    expect(next.clips[0]).toEqual(
      expect.objectContaining({
        assetId,
        trackId: MAIN_VIDEO_TRACK_ID,
        from: 0,
        durationInFrames: 60,
        trim: { startFrames: 240 },
      }),
    )
  })

  it('places the 2s window on overlay when main already has picture', () => {
    const withMain = addClip(withVideo(), {
      assetId,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 900,
    })
    const next = placeShotOnProject(withMain, {
      assetId,
      startMs: 8_000,
      endMs: 10_000,
      trackId: 'broll',
      from: 0,
    })
    expect(next.clips.some((clip) => clip.trackId === BROLL_TRACK_ID)).toBe(true)
    expect(next.clips.find((clip) => clip.trackId === BROLL_TRACK_ID)).toEqual(
      expect.objectContaining({
        assetId,
        trackId: BROLL_TRACK_ID,
        from: 0,
        durationInFrames: 60,
        trim: { startFrames: 240 },
      }),
    )
  })

  it('omitted trackId still means A-roll', () => {
    const next = placeShotOnProject(withVideo(), {
      assetId,
      startMs: 8_000,
      endMs: 10_000,
    })
    expect(next.clips[0]?.trackId).toBe('track_video')
  })
})
