import { describe, expect, it } from 'vitest'
import { HOSTED_PLANS } from './plans'

describe('HOSTED_PLANS (#1035)', () => {
  it('locks trial / studio / team seats, grants, list prices, and flags', () => {
    expect(HOSTED_PLANS.trial).toEqual({
      id: 'trial',
      seatLimit: 3,
      includedGrantGbp: 0,
      listGbpPerMonth: null,
      paidHostedVideo: false,
      watermarkExports: true,
      trialDays: 14,
    })
    expect(HOSTED_PLANS.studio).toEqual({
      id: 'studio',
      seatLimit: 3,
      includedGrantGbp: 25,
      listGbpPerMonth: 79,
      paidHostedVideo: true,
      watermarkExports: false,
      trialDays: null,
    })
    expect(HOSTED_PLANS.team).toEqual({
      id: 'team',
      seatLimit: 8,
      includedGrantGbp: 80,
      listGbpPerMonth: 199,
      paidHostedVideo: true,
      watermarkExports: false,
      trialDays: null,
    })
    const listPrices = Object.values(HOSTED_PLANS).map((plan) => plan.listGbpPerMonth)
    expect(listPrices).not.toContain(100)
    expect(JSON.stringify(HOSTED_PLANS)).not.toMatch(/stripe|price_/i)
  })
})
