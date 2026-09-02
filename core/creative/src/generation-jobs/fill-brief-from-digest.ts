import { randomUUID } from 'node:crypto'
import type { SourceDigest } from '../extract/types'
import { isBrandWorthyColor } from '../extract/css-colors'
import { parseExtractedBrief, type ExtractedBrief } from '../brief/extracted-brief'

export { estimateExtractGbp, isNoLlmReasoner } from './estimate-extract'

const firstSentence = (text: string): string | undefined => {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return undefined
  const match = trimmed.match(/^(.{20,160}?[.!?])(?:\s|$)/)
  return (match?.[1] ?? trimmed.slice(0, 120)).trim() || undefined
}

const shortBrandName = (value?: string): string | undefined => {
  if (!value?.trim()) return undefined
  return (
    value
      .split(/[—\-|:•]/)[0]
      ?.trim()
      .slice(0, 40) || undefined
  )
}

const ctaCandidatesFor = (displayName?: string): string[] => {
  const short = shortBrandName(displayName)
  const branded = short ? [`Try ${short}`, `Explore ${short}`] : []
  return [...branded, 'Get started', 'Learn more'].slice(0, 4)
}

const hookCandidatesFromText = (text: string): string[] => {
  const lines = text
    .split(/[\n.!?]+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 12 && line.length <= 90)
  const unique = [...new Set(lines)]
  return unique.slice(0, 5)
}

const firstWorthy = (...candidates: Array<string | undefined>): string | undefined => {
  for (const color of candidates) {
    if (color && isBrandWorthyColor(color)) return color
  }
  return undefined
}

export type FillBriefBrandAssets = {
  logoAssetId?: string
  stillAssetIds?: string[]
  /** Sampled from logo/still when theme-color is absent. */
  sampledPrimaryColor?: string
  sampledAccentColor?: string
}

/**
 * Deterministic brief fill from a source digest (no LLM).
 * Good enough for extract jobs until a reasoner enrichment pass is wired;
 * mock/CI always use this path.
 */
export const fillExtractedBriefFromDigest = (input: {
  digest: SourceDigest
  sourceUri?: string
  now?: () => Date
  brandAssets?: FillBriefBrandAssets
}): ExtractedBrief => {
  const now = (input.now ?? (() => new Date()))().toISOString()
  const id = randomUUID()
  const assets = input.brandAssets ?? {}

  if (input.digest.kind === 'url') {
    const hooks = hookCandidatesFromText(
      [input.digest.title, input.digest.description, input.digest.textDigest]
        .filter(Boolean)
        .join('. '),
    )
    const oneLiner =
      input.digest.description ?? firstSentence(input.digest.textDigest) ?? input.digest.title
    const displayName = shortBrandName(input.digest.title) ?? input.digest.title
    const ctas = ctaCandidatesFor(displayName)
    const themeColor = input.digest.themeColor
    // Prefer vivid theme → logo sample → CSS ranks. Skip slate UI chrome (#101828 etc.).
    const primaryColor =
      firstWorthy(themeColor, assets.sampledPrimaryColor, ...input.digest.colorGuesses) ??
      assets.sampledPrimaryColor ??
      themeColor ??
      input.digest.colorGuesses[0]
    const accentColor =
      firstWorthy(
        assets.sampledAccentColor,
        ...input.digest.colorGuesses.filter((color) => color !== primaryColor),
      ) ??
      assets.sampledAccentColor ??
      input.digest.colorGuesses.find((color) => color !== primaryColor)
    const stillAssetIds = assets.stillAssetIds ?? []
    return parseExtractedBrief({
      id,
      source: {
        kind: 'url',
        uri: input.sourceUri ?? input.digest.finalUrl,
        title: input.digest.title,
        fetchedAt: input.digest.fetchedAt || now,
      },
      brandCandidates: {
        displayName,
        primaryColor,
        accentColor,
        logoAssetId: assets.logoAssetId,
        stillAssetIds,
        defaultCta: ctas[0],
      },
      product: {
        name: displayName,
        oneLiner,
        benefits: hooks.slice(0, 3),
        socialProof: [],
      },
      messaging: {
        hookCandidates:
          hooks.length > 0
            ? hooks
            : [oneLiner ?? displayName ?? 'Discover something new'].filter(Boolean),
        ctaCandidates: ctas,
        audienceHints: [],
        tone: 'direct',
      },
      confidence: {
        overall: 0.55,
        fields: {
          'brandCandidates.primaryColor': primaryColor
            ? themeColor && isBrandWorthyColor(themeColor)
              ? 0.85
              : 0.65
            : 0.3,
          'brandCandidates.logoAssetId': assets.logoAssetId ? 0.75 : 0.2,
          'product.oneLiner': oneLiner ? 0.65 : 0.35,
          'messaging.hookCandidates': hooks.length > 0 ? 0.6 : 0.35,
        },
      },
      raw: input.digest.textDigest.slice(0, 8_000),
    })
  }

  const hooks = hookCandidatesFromText(input.digest.textDigest)
  const title = firstSentence(input.digest.pages[0]?.text ?? input.digest.textDigest) ?? 'PDF brief'
  const displayName = shortBrandName(title) ?? title.slice(0, 80)
  const ctas = ctaCandidatesFor(displayName)
  return parseExtractedBrief({
    id,
    source: {
      kind: 'pdf',
      blobKey: input.sourceUri,
      title,
      fetchedAt: input.digest.fetchedAt || now,
    },
    brandCandidates: {
      displayName,
      defaultCta: ctas[0],
      stillAssetIds: [],
    },
    product: {
      name: displayName,
      oneLiner: firstSentence(input.digest.textDigest),
      benefits: hooks.slice(0, 3),
      socialProof: [],
    },
    messaging: {
      hookCandidates: hooks.length > 0 ? hooks : [title],
      ctaCandidates: ctas,
      audienceHints: [],
    },
    confidence: {
      overall: 0.5,
      fields: {
        'messaging.hookCandidates': hooks.length > 0 ? 0.55 : 0.3,
        'product.oneLiner': 0.45,
      },
    },
    raw: input.digest.textDigest.slice(0, 8_000),
  })
}
