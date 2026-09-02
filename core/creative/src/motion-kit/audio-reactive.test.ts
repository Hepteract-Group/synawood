import { describe, expect, it } from 'vitest'
import { audioReactiveFontWeight, audioReactiveScale } from './audio-reactive'

describe('audio-reactive captions (#1194)', () => {
  it('does not punch when energy is below threshold', () => {
    const energy = [0.1, 0.2, 0.4, 0.5]
    expect(audioReactiveScale(energy, 0)).toBe(1)
    expect(audioReactiveScale(energy, 3)).toBe(1)
    expect(audioReactiveFontWeight(energy, 0)).toBe(600)
  })

  it('punches scale above 1 on peak frames only', () => {
    const energy = [0.1, 0.95, 0.2, 0.88]
    expect(audioReactiveScale(energy, 0)).toBe(1)
    expect(audioReactiveScale(energy, 1)).toBeGreaterThan(1)
    expect(audioReactiveScale(energy, 2)).toBe(1)
    expect(audioReactiveScale(energy, 3)).toBeGreaterThan(1)
    expect(audioReactiveFontWeight(energy, 1)).toBe(800)
  })

  it('is sparse: two peaks in a 12-frame bed, not every frame', () => {
    const energy = [0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.85, 0.1, 0.1, 0.1, 0.1]
    const punched = energy
      .map((_, frame) => audioReactiveScale(energy, frame))
      .filter((scale) => scale > 1)
    expect(punched).toHaveLength(2)
  })
})
