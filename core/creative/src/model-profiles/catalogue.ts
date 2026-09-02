import { GATEWAY_IMAGE_MODELS, isFrozenImageModelId } from './image-models'
import { GATEWAY_REASONER_MODELS, isAllowlistedReasonerModelId } from './reasoner-models'
import {
  GATEWAY_VIDEO_MODELS,
  GATEWAY_VIDEO_MODEL_IDS,
  canonicalizeVideoModelId,
  isVideoOffModelId,
} from './video-models'

export type ModelCatalogueRole = 'reason' | 'pictures' | 'video'

export type ModelCatalogueStatus = 'live' | 'frozen'

export const FROZEN_MODEL_SENTENCE = 'This model is gone from Vercel — no spend.'

export const MODEL_CATALOGUE_INTRO =
  'Supported models for chat, stills, and clips — when to use each and what they cost.'

export type ModelCatalogueEntry = {
  id: string
  label: string
  useWhen: string
  meta: string
  status: ModelCatalogueStatus
}

export type ModelCatalogueSection = {
  role: ModelCatalogueRole
  title: string
  entries: readonly ModelCatalogueEntry[]
}

export type ModelCatalogue = {
  intro: string
  sections: readonly ModelCatalogueSection[]
}

const REASON_USE_WHEN: Readonly<Record<string, string>> = {
  'openai/gpt-4.1-mini': 'Fast chat + tool calls on a budget',
  'openai/gpt-4.1': 'Complex edits and stronger reasoning',
  'minimax/minimax-m3': 'Alternate vendor for chat + tools',
  'meta/muse-spark-1.1': 'Creative reasoning with a different tone',
  'alibaba/qwen3.7-plus': 'Budget chat with solid tool use',
  'alibaba/qwen3.7-max': 'Stronger Qwen for harder edits',
  'google/gemini-3.1-flash-lite': 'Very cheap chat for simple turns',
}

const PICTURE_USE_WHEN: Readonly<Record<string, string>> = {
  'google/gemini-3.1-flash-image': 'Cheap or fast stills / infographic bases',
  'google/gemini-3-pro-image': 'Stronger stills / infographic bases',
  'spacexai/grok-imagine-image': 'Alternate stills vendor',
  'bytedance/seedream-5.0-lite': 'Draft stills',
  'bytedance/seedream-5.0-pro': 'Final-candidate stills',
}

const VIDEO_USE_WHEN: Readonly<Record<string, string>> = {
  'google/veo-3.1-fast-generate-001': 'Short 4–8s B-roll, one still, physics-y motion',
  'google/veo-3.1-generate-001': 'Same, higher quality / cost',
  'bytedance/seedance-2.0-fast': 'Longer clip, many product stills, wardrobe changes',
  'bytedance/seedance-2.5': 'Longer clip, many product stills, wardrobe changes',
}

/** Allowlisted ids confirmed Frozen on Gateway — display only (ADR-0085). */
export const FROZEN_CATALOGUE_ROWS: readonly {
  role: ModelCatalogueRole
  id: string
  label: string
  useWhen: string
  meta?: string
}[] = []

const formatGbp = (value: number): string =>
  value < 0.1 ? value.toFixed(2) : value.toFixed(value < 1 ? 2 : 1)

const reasonMeta = (gbpIn: number, gbpOut: number): string =>
  `£${formatGbp(gbpIn)}/M in · £${formatGbp(gbpOut)}/M out`

const pictureMeta = (estimateGbp: number): string => `~£${formatGbp(estimateGbp)}/image`

const videoMeta = (row: (typeof GATEWAY_VIDEO_MODELS)[number]): string => {
  const stills = row.maxInputImages === 1 ? '1 still' : `${row.maxInputImages} stills`
  const refs =
    row.maxInputVideos > 0
      ? ` · ${row.maxInputVideos} video ref${row.maxInputVideos === 1 ? '' : 's'}`
      : ''
  return `${row.maxVideoSeconds}s · ${stills}${refs} · ~£${formatGbp(row.gbpPerSecond)}/s`
}

export const isFrozenVideoModelId = (modelId: string): boolean => {
  if (isVideoOffModelId(modelId)) return false
  const id = canonicalizeVideoModelId(modelId)
  if (GATEWAY_VIDEO_MODEL_IDS.includes(id)) return false
  if (id.startsWith('google/veo') || id.startsWith('bytedance/seedance')) return true
  return false
}

export const isFrozenReasonerModelId = (modelId: string): boolean => {
  if (!modelId.trim() || modelId === 'mock-reasoner') return false
  return !isAllowlistedReasonerModelId(modelId) && modelId.includes('/')
}

export const isFrozenModelId = (modelId: string, role: ModelCatalogueRole): boolean => {
  const id = modelId.trim()
  if (!id || id === 'disabled') return false
  if (role === 'pictures') return isFrozenImageModelId(id)
  if (role === 'video') return isFrozenVideoModelId(id)
  return isFrozenReasonerModelId(id)
}

export const modelCatalogueStatus = (
  modelId: string,
  role: ModelCatalogueRole,
): ModelCatalogueStatus => (isFrozenModelId(modelId, role) ? 'frozen' : 'live')

const liveReasonEntries = (): ModelCatalogueEntry[] =>
  GATEWAY_REASONER_MODELS.map((row) => ({
    id: row.gatewayModelId,
    label: row.label,
    useWhen: REASON_USE_WHEN[row.gatewayModelId] ?? 'Chat + tool calls',
    meta: reasonMeta(row.gbpPerMillionInput, row.gbpPerMillionOutput),
    status: modelCatalogueStatus(row.gatewayModelId, 'reason'),
  }))

const livePictureEntries = (): ModelCatalogueEntry[] =>
  GATEWAY_IMAGE_MODELS.map((row) => ({
    id: row.gatewayModelId,
    label: row.label,
    useWhen: PICTURE_USE_WHEN[row.gatewayModelId] ?? row.description,
    meta: pictureMeta(row.estimateGbp),
    status: modelCatalogueStatus(row.gatewayModelId, 'pictures'),
  }))

const liveVideoEntries = (): ModelCatalogueEntry[] =>
  GATEWAY_VIDEO_MODELS.map((row) => ({
    id: row.gatewayModelId,
    label: row.label,
    useWhen: VIDEO_USE_WHEN[row.gatewayModelId] ?? row.description,
    meta: videoMeta(row),
    status: modelCatalogueStatus(row.gatewayModelId, 'video'),
  }))

const frozenEntriesForRole = (role: ModelCatalogueRole): ModelCatalogueEntry[] =>
  FROZEN_CATALOGUE_ROWS.filter((row) => row.role === role).map((row) => ({
    id: row.id,
    label: row.label,
    useWhen: row.useWhen,
    meta: row.meta ?? '—',
    status: 'frozen' as const,
  }))

const mergeEntries = (
  live: ModelCatalogueEntry[],
  frozen: ModelCatalogueEntry[],
): ModelCatalogueEntry[] => {
  const seen = new Set<string>()
  const merged: ModelCatalogueEntry[] = []
  for (const entry of [...live, ...frozen]) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    merged.push(entry)
  }
  return merged
}

export const buildModelCatalogue = (): ModelCatalogue => ({
  intro: MODEL_CATALOGUE_INTRO,
  sections: [
    {
      role: 'reason',
      title: 'Reason',
      entries: mergeEntries(liveReasonEntries(), frozenEntriesForRole('reason')),
    },
    {
      role: 'pictures',
      title: 'Pictures',
      entries: mergeEntries(livePictureEntries(), frozenEntriesForRole('pictures')),
    },
    {
      role: 'video',
      title: 'Video',
      entries: mergeEntries(liveVideoEntries(), frozenEntriesForRole('video')),
    },
  ],
})

export const roleOptionDisabled = (modelId: string, role: ModelCatalogueRole): boolean =>
  isFrozenModelId(modelId, role)

/** Append a frozen id to picker options when a project still references it. */
export const withFrozenPickerOption = (
  options: readonly { id: string; label: string; profileId?: string; disabled?: boolean }[],
  selectedId: string,
  role: ModelCatalogueRole,
): { id: string; label: string; profileId?: string; disabled?: boolean }[] => {
  if (!selectedId || !isFrozenModelId(selectedId, role)) return [...options]
  if (options.some((option) => option.id === selectedId)) {
    return options.map((option) =>
      option.id === selectedId ? { ...option, disabled: true } : option,
    )
  }
  return [...options, { id: selectedId, label: selectedId, disabled: true }]
}
