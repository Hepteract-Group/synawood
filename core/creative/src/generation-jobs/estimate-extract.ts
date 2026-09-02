import { estimateReasonerGbp } from '../pricing/estimate'

/** Fixed floor for Playwright capture + PNG upload (living estimate). */
export const EXTRACT_SCREENSHOT_GBP = 0.02

/** Assumed token budget for vision enrich until real usage metering lands. */
export const EXTRACT_VISION_INPUT_TOKENS = 8_000
export const EXTRACT_VISION_OUTPUT_TOKENS = 1_200

export const isNoLlmReasoner = (reasonerModelId: string): boolean =>
  reasonerModelId === 'mock-reasoner' || reasonerModelId.startsWith('mock-')

/**
 * Deterministic-only extract is free for No LLM (`mock-*`).
 * Paid URL extracts include screenshot + vision/reasoner estimate (ADR-0028).
 * PDF never runs vision in v1 → £0 even with a paid reasoner id.
 */
export const estimateExtractGbp = (
  reasonerModelId: string,
  options?: { sourceKind?: 'url' | 'pdf' },
): number => {
  if (isNoLlmReasoner(reasonerModelId)) return 0
  if (options?.sourceKind === 'pdf') return 0
  const reasonerGbp = estimateReasonerGbp(reasonerModelId, {
    inputTokens: EXTRACT_VISION_INPUT_TOKENS,
    outputTokens: EXTRACT_VISION_OUTPUT_TOKENS,
  })
  return Number((EXTRACT_SCREENSHOT_GBP + Math.max(reasonerGbp, 0.03)).toFixed(4))
}

/**
 * Extract click is spend consent. Block only when there is nothing left to consume
 * (monthly remaining is £0, or remaining cannot cover this estimate).
 */
export const extractCreditBlockReason = (input: {
  estimatedGbp: number
  remainingMonthlyGbp: number
}): string | null => {
  if (input.estimatedGbp <= 0) return null
  if (input.remainingMonthlyGbp <= 0) {
    return 'No generator credits left this month. Extract cannot start until there is remaining budget.'
  }
  if (input.estimatedGbp > input.remainingMonthlyGbp) {
    return `Not enough generator credits left this month. Extract needs ~£${input.estimatedGbp.toFixed(2)}; remaining ~£${input.remainingMonthlyGbp.toFixed(2)}.`
  }
  return null
}

/** Actual ledger amount after extract completes (soft-fail must not bill full vision). */
export const settleExtractActualGbp = (input: {
  estimatedGbp: number
  enrichmentSucceeded: boolean
  screenshotCaptured: boolean
}): number => {
  if (input.enrichmentSucceeded) return input.estimatedGbp
  if (input.screenshotCaptured) {
    return Math.min(EXTRACT_SCREENSHOT_GBP, Math.max(0, input.estimatedGbp))
  }
  return 0
}
