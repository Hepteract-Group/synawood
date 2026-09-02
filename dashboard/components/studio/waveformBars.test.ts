import { describe, expect, it } from 'vitest'
import { peaksFromChannelData, waveformBars } from './waveformBars'

describe('waveformBars', () => {
  it('returns a stable deterministic envelope for a seed', () => {
    const a = waveformBars('asset-a', 16)
    const b = waveformBars('asset-a', 16)
    expect(a).toEqual(b)
    expect(a).toHaveLength(16)
    expect(a.every((value) => value > 0 && value <= 1)).toBe(true)
  })

  it('differs across seeds', () => {
    expect(waveformBars('a', 12)).not.toEqual(waveformBars('b', 12))
  })

  it('downsamples PCM into normalized peaks', () => {
    const channel = new Float32Array(100)
    for (let i = 0; i < 100; i += 1) channel[i] = i < 50 ? 0.1 : 0.9
    const peaks = peaksFromChannelData([channel], 10)
    expect(peaks).toHaveLength(10)
    expect(Math.max(...peaks)).toBe(1)
    expect(peaks[0]!).toBeLessThan(peaks[peaks.length - 1]!)
  })
})
