import { describe, expect, it } from 'vitest'
import { planWantsTrialWatermark } from './trial-watermark'

describe('planWantsTrialWatermark (#1044)', () => {
  it('is true for trial and false for studio/team', () => {
    expect(planWantsTrialWatermark('trial')).toBe(true)
    expect(planWantsTrialWatermark('studio')).toBe(false)
    expect(planWantsTrialWatermark('team')).toBe(false)
  })

  it('is false when plan is missing', () => {
    expect(planWantsTrialWatermark(null)).toBe(false)
    expect(planWantsTrialWatermark(undefined)).toBe(false)
    expect(planWantsTrialWatermark('legacy')).toBe(false)
  })
})
