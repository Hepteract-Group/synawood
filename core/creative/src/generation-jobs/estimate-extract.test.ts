import { describe, expect, it } from 'vitest'
import {
  EXTRACT_SCREENSHOT_GBP,
  estimateExtractGbp,
  isNoLlmReasoner,
  settleExtractActualGbp,
} from './estimate-extract'

describe('estimateExtractGbp', () => {
  it('is free for mock reasoners and PDF sources', () => {
    expect(isNoLlmReasoner('mock-reasoner')).toBe(true)
    expect(estimateExtractGbp('mock-reasoner')).toBe(0)
    expect(estimateExtractGbp('openai/gpt-4.1-mini', { sourceKind: 'pdf' })).toBe(0)
  })

  it('prices screenshot + vision for paid URL extracts', () => {
    const gbp = estimateExtractGbp('openai/gpt-4.1-mini', { sourceKind: 'url' })
    expect(gbp).toBeGreaterThanOrEqual(EXTRACT_SCREENSHOT_GBP + 0.03)
  })
})

describe('settleExtractActualGbp', () => {
  it('bills full estimate when enrichment succeeds', () => {
    expect(
      settleExtractActualGbp({
        estimatedGbp: 0.12,
        enrichmentSucceeded: true,
        screenshotCaptured: true,
      }),
    ).toBe(0.12)
  })

  it('bills screenshot floor only when capture succeeded but enrich failed', () => {
    expect(
      settleExtractActualGbp({
        estimatedGbp: 0.12,
        enrichmentSucceeded: false,
        screenshotCaptured: true,
      }),
    ).toBe(EXTRACT_SCREENSHOT_GBP)
  })

  it('bills nothing when enrich and screenshot both failed', () => {
    expect(
      settleExtractActualGbp({
        estimatedGbp: 0.12,
        enrichmentSucceeded: false,
        screenshotCaptured: false,
      }),
    ).toBe(0)
  })
})
