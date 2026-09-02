/** Asset index spend estimates + soft-cap gate (#175). */

import { estimateGbp, estimateReasonerGbp } from '../pricing/estimate'
import { gateSpend, readCreativeBudgets } from '../pricing/limits'
import { resolveModelRef } from '../model-profiles'
import { ASSET_TEXT_EMBEDDING_MODEL_ID } from './embed'
import { ASSET_VISUAL_EMBEDDING_MODEL_ID } from '../model-profiles/embed-visual'

export const estimateAssetIndexGbp = (
  modelProfileId: string,
  input?: { shotCount?: number },
): {
  captionGbp: number
  transcribeGbp: number
  embedGbp: number
  visualGbp: number
  estimatedGbp: number
  captionModelId: string
  transcribeModelId: string
  embedModelId: string
  visualModelId: string
} => {
  const caption = resolveModelRef(modelProfileId, 'caption')
  const transcribe = resolveModelRef(modelProfileId, 'transcribe')
  const visual = resolveModelRef(modelProfileId, 'embed_visual')
  const shotCount = Math.max(1, Math.floor(input?.shotCount ?? 1))
  const captionGbp =
    caption.modelId === 'mock-caption' || caption.modelId.startsWith('mock-')
      ? 0
      : estimateReasonerGbp(caption.modelId, {
          inputTokens: 1200,
          outputTokens: 200,
        })
  const transcribeGbp = estimateGbp(transcribe.modelId, 30)
  // ci-stub runs mock embed (no OpenAI call); other profiles price the text embed model.
  const embedGbp = modelProfileId === 'ci-stub' ? 0 : estimateGbp(ASSET_TEXT_EMBEDDING_MODEL_ID, 1)
  const visualGbp =
    modelProfileId === 'ci-stub' || visual.modelId.startsWith('mock-')
      ? 0
      : estimateGbp(visual.modelId || ASSET_VISUAL_EMBEDDING_MODEL_ID, shotCount)
  const estimatedGbp = Number((captionGbp + transcribeGbp + embedGbp + visualGbp).toFixed(4))
  return {
    captionGbp,
    transcribeGbp,
    embedGbp,
    visualGbp,
    estimatedGbp,
    captionModelId: caption.modelId,
    transcribeModelId: transcribe.modelId,
    embedModelId: ASSET_TEXT_EMBEDDING_MODEL_ID,
    visualModelId: visual.modelId,
  }
}

export const gateAssetIndexSpend = (input: {
  estimatedGbp: number
  spentThisMonthGbp: number
  spentThisWeekGbp: number
  spentThisProjectGbp: number
  confirmSpend?: boolean
}): { ok: true } | { ok: false; error: string } => {
  if (input.estimatedGbp <= 0) return { ok: true }
  const gate = gateSpend({
    estimatedGbp: input.estimatedGbp,
    spentThisMonthGbp: input.spentThisMonthGbp,
    spentThisWeekGbp: input.spentThisWeekGbp,
    spentThisProjectGbp: input.spentThisProjectGbp,
    budgets: readCreativeBudgets(),
    requireConfirm: true,
    confirmSpend: input.confirmSpend,
    suggestProfile: 'ci-stub',
  })
  if (!gate.ok) return { ok: false, error: gate.error }
  return { ok: true }
}
