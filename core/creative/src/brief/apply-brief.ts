import type { ExtractedBrief } from './extracted-brief'
import { parseExtractedBrief } from './extracted-brief'
import type { StudioProject } from '../project/schema'
import { setEndCard, setHookTitle } from '../project/operations'

export type FirstCutMode = 'minimal' | 'director'

export type ApplyBriefResult = {
  project: StudioProject
  modeUsed: FirstCutMode
  /** Set when director was requested but Wave 2A is not available. */
  warning?: string
  hookText?: string
  endCardText?: string
}

const displayNameFromBrief = (brief: ExtractedBrief): string | undefined =>
  brief.brandCandidates.displayName?.trim() || brief.product.name?.trim() || undefined

const defaultCtaFromBrief = (brief: ExtractedBrief): string | undefined =>
  brief.brandCandidates.defaultCta?.trim() || brief.messaging.ctaCandidates[0]?.trim() || undefined

const topHook = (brief: ExtractedBrief): string | undefined => {
  const display = brief.brandCandidates.displayName?.trim()
  const preferred = brief.messaging.hookCandidates.find((hook) => {
    const text = hook.trim()
    if (!text) return false
    if (display && text === display) return false
    return text.length <= 72
  })
  return (
    preferred?.trim() ||
    brief.messaging.hookCandidates[0]?.trim() ||
    brief.product.oneLiner?.trim() ||
    undefined
  )
}

const topCta = (brief: ExtractedBrief): string | undefined =>
  brief.messaging.ctaCandidates[0]?.trim() || brief.brandCandidates.defaultCta?.trim() || undefined

/**
 * Map ExtractedBrief → project.brand + Path C overlays (ADR-0027 minimal first cut).
 * Does not call Director (#139) or enqueue generates — colors/CTA/hooks only unless
 * logo/still asset ids are already present on the brief.
 */
export const applyBriefMinimal = (input: {
  project: StudioProject
  brief: ExtractedBrief
}): ApplyBriefResult => {
  const brief = parseExtractedBrief(input.brief)
  const displayName = displayNameFromBrief(brief)
  const defaultCta = defaultCtaFromBrief(brief)
  const stillAssetIds = brief.brandCandidates.stillAssetIds ?? []

  let project: StudioProject = {
    ...input.project,
    brand: {
      productId: input.project.productId,
      displayName,
      primaryColor: brief.brandCandidates.primaryColor,
      accentColor: brief.brandCandidates.accentColor,
      fontFamily: brief.brandCandidates.fontFamily,
      defaultCta,
      mood: brief.messaging.tone,
      logoAssetId: brief.brandCandidates.logoAssetId,
      stillAssetIds,
      stillAssetId: stillAssetIds[0],
      chrome: input.project.brand?.chrome,
      captionBg: input.project.brand?.captionBg,
      voiceId: input.project.brand?.voiceId,
      logoMonoAssetId: input.project.brand?.logoMonoAssetId,
    },
    brief,
  }

  const hookText = topHook(brief)
  const endCardText = topCta(brief)
  if (hookText) project = setHookTitle(project, hookText.slice(0, 120))
  if (endCardText) project = setEndCard(project, endCardText.slice(0, 160))

  return {
    project,
    modeUsed: 'minimal',
    hookText,
    endCardText,
  }
}

/** Apply brief with requested mode. Director falls back to minimal until #139. */
export const applyBriefToProject = (input: {
  project: StudioProject
  brief: ExtractedBrief
  firstCutMode?: FirstCutMode
}): ApplyBriefResult => {
  const requested = input.firstCutMode ?? 'minimal'
  if (requested === 'director') {
    const minimal = applyBriefMinimal(input)
    return {
      ...minimal,
      warning:
        'Director mode requires Wave 2A (#139). Applied minimal first cut (brand + hook/CTA overlays).',
    }
  }
  return applyBriefMinimal(input)
}
