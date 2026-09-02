/** Orchestrate campaign pack still batch (#110). */

import type { StudioToolContext } from '../tools/types'
import { toolFail, toolOk, type ToolOutcome } from '../tools/types'
import { applyProjectMutation } from '../tools/store'
import { runGenerateImageTool } from '../tools/generator-tools'
import { attachFallbackBrand, requireBrand } from '../brand'
import {
  buildCampaignBackgroundPrompt,
  planCampaignCreatives,
  setCreativeBackground,
} from '../project/campaign-ops'
import { isCampaignPackComposition } from '../project/schema'
import type { ModelProfileId } from '../model-profiles/registry'
import { estimateCampaignBatchGbp, gateCampaignBatchSpend } from './batch-spend'
import { draftHeadlinesFromBrief } from './draft-headlines'
import { campaignImageProfileNote, resolveCampaignImageProfileId } from './image-profile'

export const runGenerateCampaignCreatives = async (
  ctx: StudioToolContext,
  input: {
    count?: number
    headlines?: string[]
    /** When set, only these creatives get new stills (Regenerate selected). */
    creativeIds?: string[]
    confirmSpend?: boolean
    /** When true, return estimate only — do not generate. */
    estimateOnly?: boolean
  },
): Promise<ToolOutcome> => {
  if (!isCampaignPackComposition(ctx.project.compositionId) || !ctx.project.campaignPack) {
    return toolFail(
      'generate_campaign_creatives requires a Campaign Pack project (composition campaign-pack-still).',
    )
  }

  const brief = ctx.project.campaignPack.brief
  if (!brief.prompt.trim() && !(input.headlines && input.headlines.length > 0)) {
    return toolFail('Set a campaign brief prompt (set_campaign_brief) or pass headlines first.')
  }

  if (!ctx.project.brand) {
    await applyProjectMutation(
      ctx,
      (current) =>
        attachFallbackBrand({
          project: current,
          productId: current.productId,
          displayName: current.name,
        }).project,
      'Attach fallback brand',
    )
  }
  try {
    requireBrand(ctx.project)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Project brand required'
    return toolFail(message)
  }

  const existingCount = ctx.project.campaignPack.creatives.length
  const count = Math.min(
    12,
    Math.max(1, input.count ?? input.headlines?.length ?? (existingCount > 0 ? existingCount : 3)),
  )

  const imageProfileId = resolveCampaignImageProfileId(ctx.modelProfileId)
  const profileNote = campaignImageProfileNote(ctx.modelProfileId, imageProfileId)
  let estimate: ReturnType<typeof estimateCampaignBatchGbp>
  try {
    estimate = estimateCampaignBatchGbp({
      modelProfileId: imageProfileId as ModelProfileId,
      count,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not estimate campaign spend'
    return toolFail(
      `${message} Switch the pack profile to ci-stub, cheap-draft, or balanced (founder-edit disables image generation).`,
    )
  }

  if (input.estimateOnly) {
    return toolOk(`Estimated £${estimate.estimatedGbp.toFixed(2)} for ${count} creatives`, {
      ...estimate,
      estimateOnly: true,
      needsConfirmSpend: estimate.estimatedGbp > 0,
      profileNote,
      modelProfileId: imageProfileId,
    })
  }

  const gate = gateCampaignBatchSpend({
    estimatedGbp: estimate.estimatedGbp,
    count,
    confirmSpend: input.confirmSpend,
  })
  if (!gate.ok) {
    return toolFail(gate.error)
  }

  const previousProfile = ctx.modelProfileId
  ctx.modelProfileId = imageProfileId

  const headlines =
    input.headlines && input.headlines.length > 0
      ? input.headlines.slice(0, count)
      : ctx.project.campaignPack.creatives.slice(0, count).map((c) => c.headline)

  const existing = ctx.project.campaignPack.creatives
  const existingHeadlines = existing.slice(0, count).map((c) => c.headline)
  const headlinesMatch =
    headlines.length === existingHeadlines.length &&
    headlines.every((headline, index) => headline === existingHeadlines[index])
  const needsReplan =
    !(input.creativeIds && input.creativeIds.length > 0) &&
    (existing.length === 0 ||
      existing.length !== count ||
      (headlines.length > 0 && !headlinesMatch))

  if (needsReplan) {
    try {
      await applyProjectMutation(ctx, (current) =>
        planCampaignCreatives(current, {
          count,
          headlines:
            headlines.length > 0 ? headlines : draftHeadlinesFromBrief(brief.prompt, count),
        }),
      )
    } catch (error) {
      // Same headlines/count already planned — continue to (re)generate stills (#465).
      const message = error instanceof Error ? error.message : ''
      if (!/nothing new to apply/i.test(message)) throw error
    }
  }

  // Prefer explicit ids (Regenerate selected); else headlines filter; else first N.
  const byId = new Map((ctx.project.campaignPack?.creatives ?? []).map((c) => [c.id, c]))
  const targetCreatives =
    input.creativeIds && input.creativeIds.length > 0
      ? input.creativeIds
          .map((id) => byId.get(id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
      : input.headlines && input.headlines.length > 0
        ? (ctx.project.campaignPack?.creatives ?? []).filter((creative) =>
            headlines.includes(creative.headline),
          )
        : (ctx.project.campaignPack?.creatives.slice(0, count) ?? [])

  const aspectRatio = brief.aspect
  const refs = brief.imageAssetIds ?? []
  const generated: Array<{ creativeId: string; assetId: string }> = []

  try {
    for (const creative of targetCreatives) {
      const prompt = buildCampaignBackgroundPrompt({
        briefPrompt: brief.prompt || creative.headline,
        headline: creative.headline,
        notes: brief.notes,
        aspect: brief.aspect,
      })
      const gen = await runGenerateImageTool(ctx, {
        prompt,
        aspectRatio,
        referenceAssetIds: refs.length > 0 ? refs : undefined,
      })
      if (!gen.ok) {
        return toolFail(
          `${gen.error ?? `Failed generating still for ${creative.id}`} (${generated.length}/${targetCreatives.length} done; estimate £${estimate.estimatedGbp.toFixed(2)})`,
        )
      }
      const assetId = String((gen.data as { assetId?: string } | undefined)?.assetId ?? '')
      if (!assetId) {
        return toolFail(`Image generation did not return an assetId for ${creative.id}`)
      }
      await applyProjectMutation(ctx, (current) =>
        setCreativeBackground(current, { creativeId: creative.id, backgroundAssetId: assetId }),
      )
      generated.push({ creativeId: creative.id, assetId })
    }
  } finally {
    ctx.modelProfileId = previousProfile
  }

  if (generated.length === 0) {
    return toolFail('No creatives to generate stills for. Add a creative or select cards first.')
  }

  return toolOk(
    `Generated ${generated.length} campaign creatives (~£${estimate.estimatedGbp.toFixed(2)})${profileNote ? ` — ${profileNote}` : ''}`,
    {
      ...estimate,
      generated,
      creativeIds: generated.map((row) => row.creativeId),
      revision: ctx.project.revision,
      profileNote,
      modelProfileId: imageProfileId,
    },
  )
}
