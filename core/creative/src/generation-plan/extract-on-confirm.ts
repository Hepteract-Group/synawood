import { EXTRACT_SCREENSHOT_GBP } from '../generation-jobs/estimate-extract'

export const parseExtraExtractUrlLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

/**
 * URLs to crawl on plan confirm. Extra lines always; existing source URLs only
 * when Re-extract is on. Unique, trimmed.
 */
export const extractUrlsForPlanConfirm = (input: {
  extraExtractUrls?: string[]
  reExtractThisTurn?: boolean
  existingSourceUrls?: string[]
}): string[] => {
  const extra = (input.extraExtractUrls ?? []).map((url) => url.trim()).filter(Boolean)
  const existing = input.reExtractThisTurn
    ? (input.existingSourceUrls ?? []).map((url) => url.trim()).filter(Boolean)
    : []
  return [...new Set([...extra, ...existing])]
}

/**
 * Default confirm reuses Product Extracts. Recrawl only when the operator
 * ticks Re-extract or lists extra URLs (#1099 / #1100).
 */
export const shouldEnqueueExtractOnPlanConfirm = (input: {
  reExtractThisTurn?: boolean
  extraExtractUrls?: string[]
}): boolean => {
  if (input.reExtractThisTurn) return true
  if ((input.extraExtractUrls ?? []).length > 0) return true
  return false
}

/**
 * Matches `estimateProductExtractEnqueueGbp` (screenshot floor per URL).
 * Product extract jobs do not debit brief-extract vision (`estimateExtractGbp`).
 */
export const extractCostForPlanGbp = (input: {
  reExtractThisTurn?: boolean
  extraExtractUrls?: string[]
  existingSourceUrls?: string[]
}): number => {
  if (!shouldEnqueueExtractOnPlanConfirm(input)) return 0
  const urlCount = extractUrlsForPlanConfirm(input).length
  return Number((EXTRACT_SCREENSHOT_GBP * Math.max(1, urlCount)).toFixed(4))
}
