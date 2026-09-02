import { describe, expect, it } from 'vitest'
import { estimateCampaignBatchGbp, gateCampaignBatchSpend } from './batch-spend'

describe('campaign batch spend (#110)', () => {
  it('estimates £0 for ci-stub / mock-image', () => {
    const estimate = estimateCampaignBatchGbp({ modelProfileId: 'ci-stub', count: 4 })
    expect(estimate.modelId).toBe('mock-image')
    expect(estimate.count).toBe(4)
    expect(estimate.estimatedGbp).toBe(0)
    expect(gateCampaignBatchSpend({ ...estimate, confirmSpend: false })).toEqual({ ok: true })
  })

  it('requires confirmSpend when paid estimate > 0', () => {
    const estimate = estimateCampaignBatchGbp({ modelProfileId: 'seedream-lite', count: 3 })
    expect(estimate.estimatedGbp).toBeGreaterThan(0)
    const blocked = gateCampaignBatchSpend({ ...estimate })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/confirmSpend=true/)
      expect(blocked.count).toBe(3)
    }
    expect(gateCampaignBatchSpend({ ...estimate, confirmSpend: true })).toEqual({ ok: true })
  })
})
