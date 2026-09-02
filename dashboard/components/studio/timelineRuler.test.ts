import { describe, expect, it } from 'vitest'
import {
  buildRulerTicks,
  formatRulerLabel,
  pickMajorStepFrames,
  trailingRulerFrames,
} from './timelineRuler'

describe('timelineRuler', () => {
  it('picks denser major steps when zoomed in', () => {
    const zoomedOut = pickMajorStepFrames(0.25)
    const zoomedIn = pickMajorStepFrames(4)
    expect(zoomedIn).toBeLessThan(zoomedOut)
  })

  it('builds continuous major+minor ticks across the strip', () => {
    const ticks = buildRulerTicks({ endFrame: 300, pixelsPerFrame: 1 })
    expect(ticks[0]).toMatchObject({ frame: 0, major: true })
    expect(ticks.some((tick) => !tick.major)).toBe(true)
    expect(ticks[ticks.length - 1]!.frame).toBe(300)
    const majors = ticks.filter((tick) => tick.major)
    expect(majors.every((tick) => typeof tick.label === 'string')).toBe(true)
  })

  it('formats fine labels with frames when deeply zoomed', () => {
    expect(formatRulerLabel(45, 1)).toMatch(/0:01:15/)
    expect(formatRulerLabel(150, 150)).toBe('0:05')
  })

  it('adds trailing empty-time frames for the infinite-scroll impression', () => {
    expect(trailingRulerFrames(1, 520)).toBe(520)
    expect(trailingRulerFrames(0.1, 520)).toBeGreaterThan(520)
  })
})
