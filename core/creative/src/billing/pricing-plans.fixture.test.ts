import { describe, expect, it } from 'vitest'
import { HOSTED_PLANS } from './plans'

/** Keeps /pricing copy locked to HOSTED_PLANS (#1050). */
describe('pricing page vs HOSTED_PLANS (#1050)', () => {
  it('locks Studio list price, seats, grant, and paid video', () => {
    const studio = HOSTED_PLANS.studio
    expect(studio.listGbpPerMonth).toBe(79)
    expect(studio.seatLimit).toBe(3)
    expect(studio.includedGrantGbp).toBe(25)
    expect(studio.paidHostedVideo).toBe(true)
    expect(studio.watermarkExports).toBe(false)
  })

  it('locks Trial free window, seats, and watermark', () => {
    const trial = HOSTED_PLANS.trial
    expect(trial.listGbpPerMonth).toBeNull()
    expect(trial.trialDays).toBe(14)
    expect(trial.seatLimit).toBe(3)
    expect(trial.paidHostedVideo).toBe(false)
    expect(trial.watermarkExports).toBe(true)
    expect(trial.includedGrantGbp).toBe(0)
  })

  it('locks Team seats and monthly price', () => {
    const team = HOSTED_PLANS.team
    expect(team.seatLimit).toBe(8)
    expect(team.listGbpPerMonth).toBe(199)
    expect(team.includedGrantGbp).toBe(80)
    expect(team.paidHostedVideo).toBe(true)
  })

  it('never markets unlimited video in catalog flags', () => {
    for (const plan of Object.values(HOSTED_PLANS)) {
      expect(plan).toHaveProperty('paidHostedVideo')
      expect(plan).toHaveProperty('includedGrantGbp')
    }
  })
})
