import { describe, expect, it } from 'vitest'
import { estimateAssetIndexGbp, gateAssetIndexSpend } from './estimate-index'

describe('estimateAssetIndexGbp (#175)', () => {
  it('is £0 for ci-stub', () => {
    const estimate = estimateAssetIndexGbp('ci-stub')
    expect(estimate.estimatedGbp).toBe(0)
    expect(estimate.visualGbp).toBe(0)
    expect(
      gateAssetIndexSpend({
        ...estimate,
        spentThisMonthGbp: 0,
        spentThisWeekGbp: 0,
        spentThisProjectGbp: 0,
      }).ok,
    ).toBe(true)
  })

  it('prices visual embed per shot on paid profiles (#587)', () => {
    const one = estimateAssetIndexGbp('founder-edit', { shotCount: 1 })
    const four = estimateAssetIndexGbp('founder-edit', { shotCount: 4 })
    expect(one.visualGbp).toBeGreaterThan(0)
    expect(four.visualGbp).toBe(Number((one.visualGbp * 4).toFixed(4)))
    expect(four.estimatedGbp).toBeGreaterThan(one.estimatedGbp)
  })

  it('requires confirmSpend near soft caps for paid profiles', () => {
    const estimate = estimateAssetIndexGbp('founder-edit')
    expect(estimate.estimatedGbp).toBeGreaterThan(0)
    const blocked = gateAssetIndexSpend({
      estimatedGbp: estimate.estimatedGbp,
      spentThisMonthGbp: 0,
      spentThisWeekGbp: 25,
      spentThisProjectGbp: 5,
      confirmSpend: false,
    })
    expect(blocked.ok).toBe(false)
    expect(
      gateAssetIndexSpend({
        estimatedGbp: estimate.estimatedGbp,
        spentThisMonthGbp: 0,
        spentThisWeekGbp: 25,
        spentThisProjectGbp: 5,
        confirmSpend: true,
      }).ok,
    ).toBe(true)
  })
})
