import { generateText, type LanguageModel } from 'ai'
import { getModelProfile } from '../model-profiles'
import { parseSuggestion, type Suggestion } from '../intent/schema'
import type { StudioProject } from '../project/schema'
import { dedupeSuggestions, suggestionCacheKey } from './heuristics'

const cache = new Map<string, Suggestion[]>()

export const clearSuggestionCache = (): void => {
  cache.clear()
}

const resolveSuggestModel = async (
  modelProfileId: string,
  override?: LanguageModel,
): Promise<{ model: LanguageModel | null; reasonerModelId: string }> => {
  if (override) return { model: override, reasonerModelId: 'test-reasoner' }
  const reasonerModelId = getModelProfile(modelProfileId).reasoner.modelId
  if (reasonerModelId === 'mock-reasoner') return { model: null, reasonerModelId }
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return { model: reasonerModelId as unknown as LanguageModel, reasonerModelId }
  }
  return { model: null, reasonerModelId: 'mock-reasoner' }
}

const parseSuggestionArray = (raw: string): Suggestion[] => {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const arr = JSON.parse(candidate.slice(start, end + 1)) as unknown[]
    if (!Array.isArray(arr)) return []
    return arr.flatMap((row) => {
      try {
        return [parseSuggestion(row)]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

const clipContext = (project: StudioProject, clipId: string): string => {
  const clip = project.clips.find((c) => c.id === clipId)
  if (!clip) return ''
  const asset = project.assets.find((a) => a.id === clip.assetId)
  const scene = project.scenes.find((s) => s.clipIds.includes(clipId))
  return JSON.stringify({
    clip: {
      id: clip.id,
      from: clip.from,
      durationInFrames: clip.durationInFrames,
      assetKind: asset?.kind,
    },
    scene: scene ? { id: scene.id, role: scene.role, label: scene.label } : null,
    intent: project.intent,
  })
}

export const suggestForClipReasoner = async (
  project: StudioProject,
  clipId: string,
  deps: { modelProfileId: string; model?: LanguageModel; refresh?: boolean; max?: number },
): Promise<Suggestion[]> => {
  const key = suggestionCacheKey('clip', clipId, project.revision)
  if (!deps.refresh && cache.has(key)) return cache.get(key)!

  const { model, reasonerModelId } = await resolveSuggestModel(deps.modelProfileId, deps.model)
  if (!model || reasonerModelId === 'mock-reasoner') {
    cache.set(key, [])
    return []
  }

  try {
    const result = await generateText({
      model,
      system:
        'Return a JSON array of Synawood Suggestions only. Each item: {id,label,previewText?,kind,tool,args,estimatedCostGbp,requiresGenerator}. Prefer free tools: trim_clip, split_clip, pack_clips, add_captions, assign_clip_to_scene, set_end_card. Cap at 4 items.',
      prompt: `Suggest edits for this clip:\n${clipContext(project, clipId)}`,
      maxOutputTokens: 800,
    })
    const parsed = dedupeSuggestions(parseSuggestionArray(result.text ?? '')).slice(
      0,
      deps.max ?? 4,
    )
    cache.set(key, parsed)
    return parsed
  } catch {
    cache.set(key, [])
    return []
  }
}

export const suggestForSceneReasoner = async (
  project: StudioProject,
  sceneId: string,
  deps: { modelProfileId: string; model?: LanguageModel; refresh?: boolean; max?: number },
): Promise<Suggestion[]> => {
  const key = suggestionCacheKey('scene', sceneId, project.revision)
  if (!deps.refresh && cache.has(key)) return cache.get(key)!

  const scene = project.scenes.find((s) => s.id === sceneId)
  if (!scene) return []

  const { model, reasonerModelId } = await resolveSuggestModel(deps.modelProfileId, deps.model)
  if (!model || reasonerModelId === 'mock-reasoner') {
    cache.set(key, [])
    return []
  }

  try {
    const result = await generateText({
      model,
      system:
        'Return a JSON array of Synawood Suggestions only. Prefer free tools. Cap at 4 items.',
      prompt: `Suggest edits for scene ${JSON.stringify(scene)} with intent ${JSON.stringify(project.intent)}`,
      maxOutputTokens: 800,
    })
    const parsed = dedupeSuggestions(parseSuggestionArray(result.text ?? '')).slice(
      0,
      deps.max ?? 4,
    )
    cache.set(key, parsed)
    return parsed
  } catch {
    cache.set(key, [])
    return []
  }
}
