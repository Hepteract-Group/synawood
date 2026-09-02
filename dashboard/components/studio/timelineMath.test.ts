import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  fitPixelsPerFrame,
  formatBeatWindow,
  formatClock,
  formatTimecode,
  frameFromPointer,
  pixelsPerFrameFromZoom,
  shouldSeekOnTimelinePointer,
  snapFrame,
  TRACK_LABEL_WIDTH,
  ZOOM_FACTOR_MAX,
  ZOOM_FACTOR_MIN,
} from './timelineMath'

describe('timeline math', () => {
  it('keeps the header column wide enough for MAIN cover + AUDIO mic (#1266)', () => {
    expect(TRACK_LABEL_WIDTH).toBeGreaterThanOrEqual(176)
  })

  it('formats 30fps timecode', () => {
    expect(formatTimecode(0)).toBe('00:00:00')
    expect(formatTimecode(1_845)).toBe('01:01:15')
  })

  it('formats compact clocks without frames', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(1_845)).toBe('01:01')
  })

  it('formats beat windows in clock time, not frames', () => {
    expect(formatBeatWindow(0, 90)).toBe('00:00-00:03')
  })

  it('resolves a pointer position through horizontal scroll', () => {
    expect(frameFromPointer(250, 100, 50, 2)).toBe(100)
  })

  it('seeks on empty lanes and ignores clip / header chrome', () => {
    expect(shouldSeekOnTimelinePointer({ classNames: ['track-lane', 'track-empty'] })).toBe(true)
    expect(shouldSeekOnTimelinePointer({ classNames: ['timeline-ruler'] })).toBe(true)
    expect(
      shouldSeekOnTimelinePointer({ classNames: ['clip-block is-selected', 'track-lane'] }),
    ).toBe(false)
    expect(shouldSeekOnTimelinePointer({ classNames: ['track-header'] })).toBe(false)
    expect(shouldSeekOnTimelinePointer({ classNames: ['track-lane'], tags: ['BUTTON'] })).toBe(
      false,
    )
  })

  it('snaps only within the threshold', () => {
    expect(snapFrame(98, [0, 100, 200], 3)).toBe(100)
    expect(snapFrame(95, [0, 100, 200], 3)).toBe(95)
  })

  it('fits project duration into the visible lane without clamping short projects', () => {
    const ppf = fitPixelsPerFrame(300, 900)
    expect(ppf).toBeCloseTo(884 / 300, 5)
    expect(300 * ppf).toBeLessThanOrEqual(900)
  })

  it('maps zoom factor 1 to fit and higher factors to deeper zoom', () => {
    const fit = fitPixelsPerFrame(300, 900)
    expect(pixelsPerFrameFromZoom(fit, ZOOM_FACTOR_MIN)).toBeCloseTo(fit, 5)
    expect(pixelsPerFrameFromZoom(fit, 2)).toBeCloseTo(fit * 2, 5)
    expect(pixelsPerFrameFromZoom(fit, ZOOM_FACTOR_MAX)).toBeGreaterThan(fit)
  })
})

describe('authored MAIN span (#1267)', () => {
  it('renders a coverage span that seeks, not add_clip', () => {
    const timeline = readFileSync(join(process.cwd(), 'components/studio/Timeline.tsx'), 'utf8')
    expect(timeline).toMatch(/authored-motion-span/)
    expect(timeline).toMatch(/authoredSequenceCoverage/)
    expect(timeline).toMatch(/authoredMotionSpanLayout/)
    expect(timeline).toMatch(/isAuthoredComposition/)
    expect(timeline).toMatch(/Motion ad/)
  })
})
