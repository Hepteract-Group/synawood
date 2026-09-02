import { describe, expect, it } from 'vitest'
import { durationFramesFromSeconds } from './media-probe'

describe('durationFramesFromSeconds', () => {
  it('rounds seconds to frames at project fps', () => {
    expect(durationFramesFromSeconds(152, 30)).toBe(4560)
    expect(durationFramesFromSeconds(11, 30)).toBe(330)
  })

  it('never returns less than one frame', () => {
    expect(durationFramesFromSeconds(0.001, 30)).toBe(1)
  })
})
