import { describe, expect, it } from 'vitest'
import { authoredInterpolate } from './safe-interpolate'

describe('authoredInterpolate', () => {
  it('clamps spring overshoot instead of throwing', () => {
    expect(() => authoredInterpolate(1.2, [0, 1], [0.5, 1])).not.toThrow()
    expect(authoredInterpolate(1.2, [0, 1], [0.5, 1])).toBe(1)
    expect(authoredInterpolate(-0.2, [0, 1], [0.5, 1])).toBe(0.5)
  })
})
