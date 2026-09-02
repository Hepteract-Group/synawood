import { describe, expect, it } from 'vitest'
import { isPlacementRequest, resolvePlacementIntent } from './placement'
import type { ProjectClip } from '../project/schema'

const FPS = 30

const clip = (from: number, duration: number, id = 'c1'): ProjectClip => ({
  id,
  trackId: 'main',
  assetId: `asset-${id}`,
  from,
  durationInFrames: duration,
  trim: { startFrames: 0 },
})

const project = (clips: ProjectClip[], durationFrames = 300) => ({
  clips,
  durationFrames,
  fps: FPS,
})

describe('resolvePlacementIntent', () => {
  it('appends to the end of the last clip for "at the end" phrasing', () => {
    const clips = [clip(0, 300)]
    const intent = resolvePlacementIntent(
      '@asset:foo add this to the end of the current video',
      project(clips),
    )
    expect(intent).toEqual({ kind: 'append', from: 300 })
  })

  it('appends for "append / extend / continue / follow" phrasing', () => {
    const clips = [clip(0, 150), clip(150, 150)]
    expect(resolvePlacementIntent('append this clip', project(clips))).toEqual({
      kind: 'append',
      from: 300,
    })
    expect(resolvePlacementIntent('extend the video with this', project(clips))).toEqual({
      kind: 'append',
      from: 300,
    })
    expect(resolvePlacementIntent('continue with this clip', project(clips))).toEqual({
      kind: 'append',
      from: 300,
    })
  })

  it('resolves explicit seconds even with "into the video" trailing words', () => {
    const intent = resolvePlacementIntent(
      'Add @asset:foo to thefootage at 5 seconds into the video',
      project([clip(0, 300)]),
    )
    expect(intent).toEqual({ kind: 'explicit', from: 150 })
  })

  it('resolves explicit frame numbers', () => {
    expect(resolvePlacementIntent('place it at frame 200', project([]))).toEqual({
      kind: 'explicit',
      from: 200,
    })
    expect(resolvePlacementIntent('at 200f', project([]))).toEqual({ kind: 'explicit', from: 200 })
  })

  it('resolves replace intent to the first clip position', () => {
    const clips = [clip(90, 210)]
    expect(resolvePlacementIntent('replace the current clip with this', project(clips))).toEqual({
      kind: 'replace',
      from: 90,
    })
    expect(resolvePlacementIntent('replace it', project([]))).toEqual({ kind: 'replace', from: 0 })
  })

  it('defaults to the end of existing clips to avoid overlap', () => {
    expect(resolvePlacementIntent('add captions "hello"', project([clip(0, 300)]))).toEqual({
      kind: 'default',
      from: 300,
    })
  })

  it('defaults to 0 on an empty timeline', () => {
    expect(resolvePlacementIntent('add a clip', project([]))).toEqual({ kind: 'default', from: 0 })
  })

  it('never returns a negative frame', () => {
    const intent = resolvePlacementIntent('at 0s', project([]))
    expect(intent.from).toBeGreaterThanOrEqual(0)
  })
})

describe('isPlacementRequest', () => {
  it('detects placement phrasing', () => {
    expect(isPlacementRequest('add this to the end')).toBe(true)
    expect(isPlacementRequest('insert at 5s')).toBe(true)
    expect(isPlacementRequest('replace the clip')).toBe(true)
  })

  it('detects Add @asset … at Ns / to the footage', () => {
    expect(
      isPlacementRequest(
        'Add @asset:stills-editor-truth-svg-52d3ccec to thefootage at 5 seconds into the video',
      ),
    ).toBe(true)
    expect(isPlacementRequest('@asset:foo-abcdef12 at 5 seconds')).toBe(true)
  })

  it('ignores non-placement messages', () => {
    expect(isPlacementRequest('add captions "hello"')).toBe(false)
    expect(isPlacementRequest('generate an image')).toBe(false)
  })
})
