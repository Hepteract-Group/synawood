import { describe, expect, it } from 'vitest'
import { resolveTurnMaxSteps } from './max-steps'
import { DEFAULT_MAX_STEPS, MOTION_FIRST_PASS_MAX_STEPS } from './types'

describe('resolveTurnMaxSteps (#1257)', () => {
  it('keeps talking-head turns at the default cap', () => {
    expect(
      resolveTurnMaxSteps({
        userMessage: 'polish the talking-head take',
        compositionId: 'talking-head-60',
      }),
    ).toBe(DEFAULT_MAX_STEPS)
    expect(DEFAULT_MAX_STEPS).toBe(16)
  })

  it('gives motion first-pass room to inspect and patch CountUp', () => {
    expect(
      resolveTurnMaxSteps({
        userMessage: 'Make a 15-second vertical kinetic type ad',
        compositionId: 'talking-head-60',
      }),
    ).toBe(MOTION_FIRST_PASS_MAX_STEPS)
    expect(
      resolveTurnMaxSteps({
        userMessage: 'add CountUp',
        compositionId: 'authored',
      }),
    ).toBe(MOTION_FIRST_PASS_MAX_STEPS)
    expect(MOTION_FIRST_PASS_MAX_STEPS).toBeGreaterThanOrEqual(24)
  })
})
