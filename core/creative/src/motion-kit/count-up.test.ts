import { describe, expect, it } from 'vitest'
import { countUpDisplayed } from './count-up'

describe('countUpDisplayed (#1269)', () => {
  it('does not throw when the agent passes to= and omits value', () => {
    expect(() =>
      countUpDisplayed({ frame: 10, to: 10000, from: 0, durationInFrames: 60 }),
    ).not.toThrow()
    expect(countUpDisplayed({ frame: 0, to: 10000, durationInFrames: 60 })).toBe(0)
    expect(countUpDisplayed({ frame: 60, to: 10000, durationInFrames: 60 })).toBe(10000)
    expect(countUpDisplayed({ frame: 30, to: 10000, durationInFrames: 60 })).toBe(5000)
  })

  it('prefers value over to', () => {
    expect(countUpDisplayed({ frame: 30, value: 40, to: 10000, durationInFrames: 30 })).toBe(40)
  })

  it('renders 0 instead of crashing when both value and to are missing', () => {
    expect(() => countUpDisplayed({ frame: 10 })).not.toThrow()
    expect(countUpDisplayed({ frame: 10 })).toBe(0)
  })
})
