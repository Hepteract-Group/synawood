import type { Suggestion } from '@synawood/creative/intent'

export type SuggestionLayer = 'heuristic' | 'reasoner' | 'generator'

export const suggestionLayer = (suggestion: Suggestion): SuggestionLayer => {
  if (suggestion.requiresGenerator || suggestion.estimatedCostGbp > 0) return 'generator'
  // Heuristic ids are sg_<hash>; reasoner may use other prefixes — treat free as heuristic by default.
  if (suggestion.id.startsWith('sg_')) return 'heuristic'
  return 'reasoner'
}

export const suggestionCostLabel = (suggestion: Suggestion): string => {
  if (suggestion.estimatedCostGbp <= 0) return 'free'
  return `est £${suggestion.estimatedCostGbp.toFixed(2)}`
}

/** Free heuristics checked by default; paid / generator unchecked. */
export const defaultSelectedSuggestionIds = (suggestions: Suggestion[]): Set<string> => {
  const selected = new Set<string>()
  for (const suggestion of suggestions) {
    if (
      !suggestion.requiresGenerator &&
      suggestion.estimatedCostGbp <= 0 &&
      suggestion.kind !== 'broll'
    ) {
      selected.add(suggestion.id)
    }
  }
  return selected
}

const layerRank: Record<SuggestionLayer, number> = {
  heuristic: 0,
  reasoner: 1,
  generator: 2,
}

export const sortSuggestions = (suggestions: Suggestion[]): Suggestion[] =>
  [...suggestions].sort((a, b) => {
    const layerDiff = layerRank[suggestionLayer(a)] - layerRank[suggestionLayer(b)]
    if (layerDiff !== 0) return layerDiff
    return a.estimatedCostGbp - b.estimatedCostGbp
  })

export const selectedSuggestionsCost = (
  suggestions: Suggestion[],
  selectedIds: ReadonlySet<string>,
): number =>
  suggestions
    .filter((suggestion) => selectedIds.has(suggestion.id))
    .reduce((sum, suggestion) => sum + suggestion.estimatedCostGbp, 0)

export const formatClipDuration = (durationFrames: number, fps: number): string => {
  const seconds = durationFrames / Math.max(1, fps)
  return `${Math.round(seconds * 10) / 10}s`
}
