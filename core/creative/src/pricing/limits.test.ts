import { describe, expect, it } from 'vitest'
import { estimateGbp, estimateReasonerGbp } from './estimate'
import { gateSpend, readCreativeBudgets } from './limits'

describe('pricing', () => {
  it('estimates mock models at zero cost', () => {
    expect(estimateGbp('mock-image', 1)).toBe(0)
    expect(estimateGbp('mock-video', 5)).toBe(0)
    expect(estimateGbp('mock-embed-visual', 4)).toBe(0)
  })

  it('prices visual embed per shot (#587)', () => {
    expect(estimateGbp('google/gemini-embedding-2', 1)).toBe(0.0002)
    expect(estimateGbp('google/gemini-embedding-2', 4)).toBe(0.0008)
  })

  it('prices live video models per second', () => {
    expect(estimateGbp('google/veo-3.1-fast-generate-001', 4)).toBe(1.6)
    expect(estimateGbp('google/veo-3.1-fast-generate-preview', 4)).toBe(1.6)
    expect(estimateGbp('bytedance/seedance-2.5', 25)).toBe(12.5)
    expect(estimateGbp('alibaba/wan-v3.0-video', 10)).toBe(0.8)
    expect(estimateGbp('minimax/minimax-h3', 10)).toBe(1.5)
    expect(estimateGbp('minimax/minimax-h3-max', 10)).toBe(0.7)
  })

  it('estimates reasoner turns from tokens and model rates', () => {
    expect(estimateReasonerGbp('mock-reasoner', { inputTokens: 1000, outputTokens: 500 })).toBe(0)
    const gbp = estimateReasonerGbp('google/gemini-3.1-flash-lite', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    expect(gbp).toBeCloseTo(0.2 + 1.2, 5)
  })

  it('rejects spend that breaches the monthly hard cap', () => {
    const gate = gateSpend({
      estimatedGbp: 40,
      spentThisMonthGbp: 90,
      spentThisWeekGbp: 0,
      spentThisProjectGbp: 0,
      budgets: readCreativeBudgets({}),
      requireConfirm: false,
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.error).toMatch(/monthly generator cap/i)
    }
  })

  it('allows £0 work when the monthly remaining is already zero', () => {
    const gate = gateSpend({
      estimatedGbp: 0,
      spentThisMonthGbp: 100,
      spentThisWeekGbp: 0,
      spentThisProjectGbp: 0,
      budgets: readCreativeBudgets({}),
      requireConfirm: false,
    })
    expect(gate.ok).toBe(true)
  })

  it('requires confirmSpend above soft caps when asked', () => {
    const gate = gateSpend({
      estimatedGbp: 2,
      spentThisMonthGbp: 0,
      spentThisWeekGbp: 24,
      spentThisProjectGbp: 0,
      budgets: { monthlyGeneratorCap: 100, weeklySoftCap: 25, perProjectWarnGbp: 5 },
      requireConfirm: true,
      confirmSpend: false,
      suggestProfile: 'seedream-lite',
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.error).toMatch(/confirmSpend=true/)
    }
  })
})
