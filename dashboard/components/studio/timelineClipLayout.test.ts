import { describe, expect, it } from 'vitest'
import { CLIP_TRIM_HANDLE_PX, clipVisibleChrome, timelineExtentFrames } from './timelineClipLayout'

describe('timelineExtentFrames (#1372)', () => {
  it('includes audio that sticks past picture duration', () => {
    expect(
      timelineExtentFrames({
        durationFrames: 480,
        clips: [{ from: 0, durationInFrames: 856 }],
        overlays: [],
      }),
    ).toBe(856)
  })

  it('does not shrink below project duration', () => {
    expect(
      timelineExtentFrames({
        durationFrames: 900,
        clips: [{ from: 0, durationInFrames: 300 }],
        overlays: [],
      }),
    ).toBe(900)
  })
})

describe('clipVisibleChrome (#1372)', () => {
  it('pins the end handle to the visible right when the clip overflows the viewport', () => {
    const chrome = clipVisibleChrome({
      from: 0,
      durationInFrames: 900,
      viewportStartFrame: 0,
      viewportEndFrame: 480,
      pixelsPerFrame: 1,
    })
    expect(chrome.endHandleLeftPx).toBe(480 - CLIP_TRIM_HANDLE_PX)
    expect(chrome.deleteLeftPx).toBeGreaterThan(400)
    expect(chrome.deleteLeftPx).toBeLessThan(chrome.endHandleLeftPx)
  })

  it('keeps the real end handle when the clip fits', () => {
    const chrome = clipVisibleChrome({
      from: 0,
      durationInFrames: 200,
      viewportStartFrame: 0,
      viewportEndFrame: 480,
      pixelsPerFrame: 1,
    })
    expect(chrome.endHandleLeftPx).toBe(200 - CLIP_TRIM_HANDLE_PX)
  })
})
