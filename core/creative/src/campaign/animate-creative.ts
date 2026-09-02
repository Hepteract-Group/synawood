/** Still-to-motion for campaign creatives (#113). */

import type { StudioToolContext } from '../tools/types'
import { toolFail, toolOk, type ToolOutcome } from '../tools/types'
import { applyProjectMutation } from '../tools/store'
import { runGenerateVideoClipTool } from '../tools/generator-tools'
import { isCampaignPackComposition } from '../project/schema'
import { setCampaignCreative } from '../project/campaign-ops'
import { estimateGbp } from '../pricing/estimate'
import { resolveModelRef } from '../model-profiles'
import { campaignGeneratorProfileNote, resolveCampaignVideoProfileId } from './image-profile'

export const estimateAnimateGbp = (input: {
  modelProfileId: string
  durationSeconds?: number
}): { modelId: string; durationSeconds: number; estimatedGbp: number } => {
  const videoProfileId = resolveCampaignVideoProfileId(input.modelProfileId)
  const model = resolveModelRef(videoProfileId, 'video')
  const durationSeconds = Math.min(Math.max(1, input.durationSeconds ?? 4), 8)
  return {
    modelId: model.modelId,
    durationSeconds,
    estimatedGbp: estimateGbp(model.modelId, durationSeconds),
  }
}

export const runAnimateCampaignCreative = async (
  ctx: StudioToolContext,
  input: {
    creativeId: string
    /** When true, prompt asks for camera motion only — no baked text. */
    withoutText?: boolean
    confirmSpend?: boolean
    durationSeconds?: number
    estimateOnly?: boolean
  },
): Promise<ToolOutcome> => {
  if (!isCampaignPackComposition(ctx.project.compositionId) || !ctx.project.campaignPack) {
    return toolFail('Animate requires a Campaign Pack project.')
  }
  const creative = ctx.project.campaignPack.creatives.find((row) => row.id === input.creativeId)
  if (!creative) {
    return toolFail(`Unknown creative ${input.creativeId}`)
  }
  if (!creative.backgroundAssetId) {
    return toolFail('Generate a still background before Animate.')
  }

  const videoProfileId = resolveCampaignVideoProfileId(ctx.modelProfileId)
  const profileNote = campaignGeneratorProfileNote(ctx.modelProfileId, videoProfileId, 'video')

  let estimate: ReturnType<typeof estimateAnimateGbp>
  try {
    estimate = estimateAnimateGbp({
      modelProfileId: videoProfileId,
      durationSeconds: input.durationSeconds,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not estimate Animate spend'
    return toolFail(
      `${message} Switch the pack profile to ci-stub, cheap-draft, or balanced (founder-edit disables video).`,
    )
  }

  if (input.estimateOnly) {
    return toolOk(`Estimated £${estimate.estimatedGbp.toFixed(2)} to animate ${input.creativeId}`, {
      ...estimate,
      estimateOnly: true,
      needsConfirmSpend: estimate.estimatedGbp > 0,
      creativeId: input.creativeId,
      profileNote,
      modelProfileId: videoProfileId,
    })
  }

  if (estimate.estimatedGbp > 0 && input.confirmSpend !== true && ctx.confirmSpend !== true) {
    return toolFail(
      `Estimated £${estimate.estimatedGbp.toFixed(2)} to animate needs confirmSpend=true.`,
    )
  }

  const prompt = input.withoutText
    ? `Subtle camera motion on this branded still. No text, logos, or watermarks in the video. ${ctx.project.campaignPack.brief.prompt}`.slice(
        0,
        800,
      )
    : `Gentle motion for a campaign still. Keep the scene readable for Path C text overlay later. ${creative.headline}. ${ctx.project.campaignPack.brief.prompt}`.slice(
        0,
        800,
      )

  const previousProfile = ctx.modelProfileId
  ctx.modelProfileId = videoProfileId
  try {
    const gen = await runGenerateVideoClipTool(ctx, {
      prompt,
      durationSeconds: estimate.durationSeconds,
      sourceImageAssetId: creative.backgroundAssetId,
      confirmSpend: true,
    })
    if (!gen.ok) return gen

    const assetId = String((gen.data as { assetId?: string } | undefined)?.assetId ?? '')
    const jobId = (gen.data as { jobId?: string } | undefined)?.jobId
    if (!assetId) {
      return toolFail('Video generation did not return an assetId')
    }

    await applyProjectMutation(ctx, (current) =>
      setCampaignCreative(current, {
        creativeId: input.creativeId,
        patch: {
          motionAssetId: assetId,
          motionJobId: jobId ?? null,
        },
      }),
    )

    return toolOk(
      `Attached motion clip to ${input.creativeId} (not Final — export/approve separately)${profileNote ? ` — ${profileNote}` : ''}`,
      {
        creativeId: input.creativeId,
        motionAssetId: assetId,
        jobId: jobId ?? null,
        estimatedGbp: estimate.estimatedGbp,
        final: false,
        revision: ctx.project.revision,
        profileNote,
        modelProfileId: videoProfileId,
      },
    )
  } finally {
    ctx.modelProfileId = previousProfile
  }
}
