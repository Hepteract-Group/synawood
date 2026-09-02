/** Batch campaign still generation (#110). */

import { estimateGbp } from '../pricing/estimate'
import { resolveModelRef } from '../model-profiles'
import type { ModelProfileId } from '../model-profiles/registry'

export const estimateCampaignBatchGbp = (input: {
  modelProfileId: ModelProfileId | string
  count: number
}): { modelId: string; count: number; estimatedGbp: number; perImageGbp: number } => {
  const count = Math.min(12, Math.max(1, Math.floor(input.count)))
  const model = resolveModelRef(input.modelProfileId, 'image')
  const perImageGbp = estimateGbp(model.modelId, 1)
  const estimatedGbp = Number((perImageGbp * count).toFixed(4))
  return { modelId: model.modelId, count, estimatedGbp, perImageGbp }
}

export type CampaignSpendGate =
  { ok: true } | { ok: false; error: string; estimatedGbp: number; count: number }

/** Paid batch path requires confirmSpend when estimate > £0. Mock (£0) skips. */
export const gateCampaignBatchSpend = (input: {
  estimatedGbp: number
  count: number
  confirmSpend?: boolean
}): CampaignSpendGate => {
  if (input.estimatedGbp > 0 && input.confirmSpend !== true) {
    return {
      ok: false,
      error: `Estimated £${input.estimatedGbp.toFixed(2)} for ${input.count} creatives needs confirmSpend=true before paid generation.`,
      estimatedGbp: input.estimatedGbp,
      count: input.count,
    }
  }
  return { ok: true }
}
