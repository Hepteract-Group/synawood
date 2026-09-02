import type { LanguageModel } from 'ai'
import type { Suggestion } from '../intent/schema'
import type { StudioProject } from '../project/schema'
import { dedupeSuggestions, suggestForClipHeuristic, suggestForSceneHeuristic } from './heuristics'
import { suggestForClipReasoner, suggestForSceneReasoner } from './reasoner'

export const buildClipSuggestions = async (
  project: StudioProject,
  clipId: string,
  opts: {
    max?: number
    modelProfileId: string
    model?: LanguageModel
    refresh?: boolean
    includeReasoner?: boolean
  },
): Promise<{ suggestions: Suggestion[]; sources: { heuristic: number; reasoner: number } }> => {
  const max = opts.max ?? 6
  const heuristic = suggestForClipHeuristic(project, clipId, { max })
  let reasoner: Suggestion[] = []
  if (opts.includeReasoner !== false) {
    reasoner = await suggestForClipReasoner(project, clipId, {
      modelProfileId: opts.modelProfileId,
      model: opts.model,
      refresh: opts.refresh,
      max: 4,
    })
  }
  const suggestions = dedupeSuggestions([...heuristic, ...reasoner]).slice(0, max)
  return {
    suggestions,
    sources: { heuristic: heuristic.length, reasoner: reasoner.length },
  }
}

export const buildSceneSuggestions = async (
  project: StudioProject,
  sceneId: string,
  opts: {
    max?: number
    modelProfileId: string
    model?: LanguageModel
    refresh?: boolean
    includeReasoner?: boolean
  },
): Promise<{ suggestions: Suggestion[]; sources: { heuristic: number; reasoner: number } }> => {
  const max = opts.max ?? 6
  const heuristic = suggestForSceneHeuristic(project, sceneId, { max })
  let reasoner: Suggestion[] = []
  if (opts.includeReasoner !== false) {
    reasoner = await suggestForSceneReasoner(project, sceneId, {
      modelProfileId: opts.modelProfileId,
      model: opts.model,
      refresh: opts.refresh,
      max: 4,
    })
  }
  const suggestions = dedupeSuggestions([...heuristic, ...reasoner]).slice(0, max)
  return {
    suggestions,
    sources: { heuristic: heuristic.length, reasoner: reasoner.length },
  }
}

export { clearSuggestionCache, suggestForClipReasoner, suggestForSceneReasoner } from './reasoner'
export { dedupeSuggestions, suggestForClipHeuristic, suggestForSceneHeuristic } from './heuristics'
