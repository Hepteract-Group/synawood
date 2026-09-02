/** Campaign pack mutations (#110) — distinct from slideshow slide-ops. */

import type { StudioProject } from './schema'
import { COMPOSITION_DISPLAY, isCampaignPackComposition } from './schema'
import {
  campaignBriefSchema,
  campaignCreativeSchema,
  campaignPackExtrasSchema,
  draftCreatives,
  emptyCampaignPackExtras,
  validateCampaignPack,
  type CampaignBrief,
  type CampaignCreative,
  type CampaignPackExtras,
} from './campaign-pack'
import { lintCampaignClaims, rewriteForbiddenClaims } from '../campaign/claim-lint'

const nextRevision = (project: StudioProject): number => project.revision + 1

const requireSafeCopy = (text: string, label: string): string => {
  const lint = lintCampaignClaims(text)
  if (lint.ok) return text
  const rewritten = rewriteForbiddenClaims(text)
  const again = lintCampaignClaims(rewritten.text)
  if (!again.ok) {
    throw new Error(
      `${label} blocked by claim lint: ${lint.hits.map((hit) => hit.pattern).join(', ')}. ${lint.hits[0]?.suggestion ?? ''}`,
    )
  }
  return rewritten.text
}

const requireCampaignPack = (project: StudioProject): CampaignPackExtras => {
  if (!isCampaignPackComposition(project.compositionId)) {
    const current = COMPOSITION_DISPLAY[project.compositionId]?.label ?? 'this format'
    throw new Error(
      `This project is a ${current} — campaign tools require a Campaign Pack project. Create one with composition campaign-pack-still.`,
    )
  }
  if (!project.campaignPack) {
    throw new Error('Project is missing campaignPack extras')
  }
  return project.campaignPack
}

const withCampaignPack = (
  project: StudioProject,
  campaignPack: CampaignPackExtras,
): StudioProject => {
  const parsed = campaignPackExtrasSchema.parse(campaignPack)
  const gate = validateCampaignPack(parsed)
  if (!gate.ok) {
    // Allow empty headlines while drafting; only enforce id/order integrity here.
    const hard = gate.issues.filter(
      (issue) => issue.code === 'duplicate_id' || issue.code === 'order_gap',
    )
    if (hard.length > 0) {
      throw new Error(hard.map((issue) => issue.message).join('; '))
    }
  }
  return {
    ...project,
    campaignPack: parsed,
    revision: nextRevision(project),
  }
}

export type SetCampaignBriefInput = {
  prompt?: string
  productId?: string | null
  aspect?: CampaignBrief['aspect']
  notes?: string | null
  imageAssetIds?: string[] | null
  suggestionSource?: CampaignBrief['suggestionSource'] | null
}

export const setCampaignBrief = (
  project: StudioProject,
  input: SetCampaignBriefInput,
): StudioProject => {
  const current = requireCampaignPack(project)
  const prompt =
    input.prompt !== undefined
      ? requireSafeCopy(input.prompt, 'Campaign brief')
      : current.brief.prompt
  const notes =
    input.notes === null
      ? undefined
      : input.notes !== undefined
        ? requireSafeCopy(input.notes, 'Campaign notes')
        : current.brief.notes
  const brief = campaignBriefSchema.parse({
    ...current.brief,
    prompt,
    productId:
      input.productId === null
        ? undefined
        : input.productId !== undefined
          ? input.productId
          : current.brief.productId,
    aspect: input.aspect ?? current.brief.aspect,
    notes,
    imageAssetIds:
      input.imageAssetIds === null
        ? undefined
        : input.imageAssetIds !== undefined
          ? input.imageAssetIds
          : current.brief.imageAssetIds,
    suggestionSource:
      input.suggestionSource === null
        ? undefined
        : input.suggestionSource !== undefined
          ? input.suggestionSource
          : current.brief.suggestionSource,
  })
  return withCampaignPack(project, { ...current, brief })
}

export type SetCampaignCreativePatch = {
  headline?: string
  body?: string | null
  cta?: string | null
  backgroundAssetId?: string | null
  motionAssetId?: string | null
  motionJobId?: string | null
  textSafe?: boolean
}

export const setCampaignCreative = (
  project: StudioProject,
  input: { creativeId: string; patch: SetCampaignCreativePatch },
): StudioProject => {
  const current = requireCampaignPack(project)
  const index = current.creatives.findIndex((creative) => creative.id === input.creativeId)
  if (index < 0) {
    throw new Error(`Unknown creative ${input.creativeId}`)
  }
  const existing = current.creatives[index]!
  const patch = input.patch
  const headline =
    patch.headline !== undefined
      ? requireSafeCopy(patch.headline, `Creative ${input.creativeId}`)
      : existing.headline
  const body =
    patch.body === null
      ? undefined
      : patch.body !== undefined
        ? requireSafeCopy(patch.body, `Creative ${input.creativeId} body`)
        : existing.body
  const cta =
    patch.cta === null
      ? undefined
      : patch.cta !== undefined
        ? requireSafeCopy(patch.cta, `Creative ${input.creativeId} CTA`)
        : existing.cta
  const next: CampaignCreative = campaignCreativeSchema.parse({
    ...existing,
    headline,
    body,
    cta,
    backgroundAssetId:
      patch.backgroundAssetId === null
        ? undefined
        : patch.backgroundAssetId !== undefined
          ? patch.backgroundAssetId
          : existing.backgroundAssetId,
    motionAssetId:
      patch.motionAssetId === null
        ? undefined
        : patch.motionAssetId !== undefined
          ? patch.motionAssetId
          : existing.motionAssetId,
    motionJobId:
      patch.motionJobId === null
        ? undefined
        : patch.motionJobId !== undefined
          ? patch.motionJobId
          : existing.motionJobId,
    textSafe: patch.textSafe ?? existing.textSafe,
  })
  const creatives = current.creatives.slice()
  creatives[index] = next
  return withCampaignPack(project, { ...current, creatives })
}

export const setCreativeBackground = (
  project: StudioProject,
  input: { creativeId: string; backgroundAssetId: string },
): StudioProject =>
  setCampaignCreative(project, {
    creativeId: input.creativeId,
    patch: { backgroundAssetId: input.backgroundAssetId },
  })

/** Replace creatives[] from headlines / count (batch generate prep). */
export const planCampaignCreatives = (
  project: StudioProject,
  input: { headlines?: string[]; count?: number },
): StudioProject => {
  const current = requireCampaignPack(project)
  const creatives = draftCreatives({
    count: input.count,
    headlines: input.headlines?.map((headline, index) =>
      requireSafeCopy(headline, `Creative headline ${index + 1}`),
    ),
  })
  return withCampaignPack(project, { ...current, creatives })
}

export const ensureCampaignPackExtras = (project: StudioProject): StudioProject => {
  if (!isCampaignPackComposition(project.compositionId)) return project
  if (project.campaignPack) return project
  return {
    ...project,
    campaignPack: emptyCampaignPackExtras(),
    revision: nextRevision(project),
  }
}

export const addCampaignCreative = (
  project: StudioProject,
  input: { headline?: string } = {},
): StudioProject => {
  const current = requireCampaignPack(project)
  const order = current.creatives.length
  if (order >= 12) {
    throw new Error('Campaign packs support at most 12 creatives')
  }
  const creative = campaignCreativeSchema.parse({
    id: `creative_${order + 1}`,
    order,
    headline: input.headline ?? '',
    textSafe: true,
  })
  return withCampaignPack(project, {
    ...current,
    creatives: [...current.creatives, creative],
  })
}

/** Drop one creative; re-number `order` so the pack stays contiguous. */
export const removeCampaignCreative = (
  project: StudioProject,
  input: { creativeId: string },
): StudioProject => {
  const current = requireCampaignPack(project)
  if (!current.creatives.some((creative) => creative.id === input.creativeId)) {
    throw new Error(`Unknown creative ${input.creativeId}`)
  }
  const creatives = [...current.creatives]
    .sort((a, b) => a.order - b.order)
    .filter((creative) => creative.id !== input.creativeId)
    .map((creative, index) => campaignCreativeSchema.parse({ ...creative, order: index }))
  return withCampaignPack(project, { ...current, creatives })
}

/** Clear still + motion on one creative (keeps the card / copy). */
export const clearCampaignCreativeMedia = (
  project: StudioProject,
  input: { creativeId: string },
): StudioProject =>
  setCampaignCreative(project, {
    creativeId: input.creativeId,
    patch: {
      backgroundAssetId: null,
      motionAssetId: null,
      motionJobId: null,
    },
  })

export const buildCampaignBackgroundPrompt = (input: {
  briefPrompt: string
  headline: string
  notes?: string
  aspect?: '1:1' | '4:5' | '9:16'
}): string => {
  const aspect = input.aspect ?? '1:1'
  const aspectLabel = aspect === '9:16' ? 'vertical' : aspect === '4:5' ? 'portrait' : 'square'
  const parts = [
    input.briefPrompt.trim(),
    input.headline.trim() ? `Creative headline: ${input.headline.trim()}` : '',
    input.notes?.trim() ? `Notes: ${input.notes.trim()}` : '',
    `${aspectLabel} campaign still (${aspect}), leave calm space for Path C text overlay, no logos or watermarks in the image.`,
  ].filter(Boolean)
  return parts.join('\n').slice(0, 800)
}
