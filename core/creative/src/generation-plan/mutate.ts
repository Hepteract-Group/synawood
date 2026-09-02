import { getModelProfile, isToolEnabled, resolveModelRef } from '../model-profiles'
import { estimateGbp } from '../pricing'
import type { StudioProject } from '../project/schema'
import {
  generationPlanSceneSchema,
  parseGenerationPlan,
  type GenerationPlan,
  type GenerationPlanScene,
} from './schema'

export const GENERATION_PLAN_NOT_NEEDED =
  'Video and image generation are off — a Generation Plan is not required. Edit the timeline directly or turn on a video/image model in Settings → Agent tools.'

const DEFAULT_SCENE_SECONDS = 4

const audienceLabel = (
  audience: { persona?: string; ageRange?: number[]; context?: string } | undefined,
): string | undefined => {
  if (!audience) return undefined
  const bits: string[] = []
  if (audience.persona) bits.push(audience.persona)
  if (audience.ageRange) bits.push(`(${audience.ageRange[0]}-${audience.ageRange[1]})`)
  if (audience.context) bits.push(audience.context)
  return bits.length > 0 ? bits.join(' ') : undefined
}

export type GenerationPlanToolContext = {
  profileId: string
  disabledOptional?: readonly string[]
}

export const isVideoGenerateAvailable = (
  profileId: string,
  disabledOptional: readonly string[] = [],
): boolean =>
  isToolEnabled(profileId, 'generate_video_clip') &&
  !disabledOptional.includes('generate_video_clip')

export const isImageGenerateAvailable = (
  profileId: string,
  disabledOptional: readonly string[] = [],
): boolean =>
  isToolEnabled(profileId, 'generate_image') && !disabledOptional.includes('generate_image')

export const isPaidGenerateAvailable = (
  profileId: string,
  disabledOptional: readonly string[] = [],
): boolean =>
  isVideoGenerateAvailable(profileId, disabledOptional) ||
  isImageGenerateAvailable(profileId, disabledOptional)

export const resolveGenerationPlanModelIds = (
  profileId: string,
  overrides?: {
    reasonerModelId?: string
    imageModelId?: string
    videoModelId?: string
  },
  disabledOptional: readonly string[] = [],
): {
  reasonerModelId: string
  imageModelId?: string
  videoModelId?: string
} => {
  const profile = getModelProfile(profileId)
  const reasonerModelId = overrides?.reasonerModelId ?? profile.reasoner.modelId
  let imageModelId: string | undefined
  let videoModelId: string | undefined

  if (isImageGenerateAvailable(profileId, disabledOptional)) {
    imageModelId = overrides?.imageModelId ?? resolveModelRef(profileId, 'image').modelId
  }
  if (isVideoGenerateAvailable(profileId, disabledOptional)) {
    videoModelId = overrides?.videoModelId ?? resolveModelRef(profileId, 'video').modelId
  }

  return { reasonerModelId, imageModelId, videoModelId }
}

export const estimateGenerationPlanCostGbp = (input: {
  scenes: readonly GenerationPlanScene[]
  runtimeSeconds?: number
  videoModelId?: string
  imageModelId?: string
  videoEnabled: boolean
  imageEnabled: boolean
}): number => {
  let total = 0

  if (input.videoEnabled && input.videoModelId) {
    if (input.scenes.length > 0) {
      for (const scene of input.scenes) {
        const seconds = scene.durationSeconds ?? DEFAULT_SCENE_SECONDS
        total += estimateGbp(input.videoModelId, seconds)
      }
    } else if (input.runtimeSeconds && input.runtimeSeconds > 0) {
      total += estimateGbp(input.videoModelId, input.runtimeSeconds)
    }
  } else if (input.imageEnabled && input.imageModelId) {
    const units = Math.max(1, input.scenes.length)
    total += estimateGbp(input.imageModelId, units)
  }

  return Math.round(total * 1000) / 1000
}

const intentPlatformLabel = (project: StudioProject): string | undefined => {
  const platform = project.intent?.platform
  return platform ? String(platform) : undefined
}

const scenesFromInput = (scenes: unknown[] | undefined): GenerationPlanScene[] =>
  (scenes ?? []).map((scene) => generationPlanSceneSchema.parse(scene))

export type DraftGenerationPlanInput = {
  goal?: string
  angle?: string
  tone?: string
  audience?: string
  runtimeSeconds?: number
  platform?: string
  scenes?: unknown[]
  assetIds?: string[]
  extraExtractUrls?: string[]
  reExtractThisTurn?: boolean
  reasonerModelId?: string
  imageModelId?: string
  videoModelId?: string
  costEstimateGbp?: number
  status?: GenerationPlan['status']
}

export type DraftGenerationPlanResult =
  { kind: 'noop'; reason: string } | { kind: 'plan'; plan: GenerationPlan }

export const draftGenerationPlan = (
  project: StudioProject,
  input: DraftGenerationPlanInput,
  ctx: GenerationPlanToolContext,
): DraftGenerationPlanResult => {
  const disabledOptional = ctx.disabledOptional ?? []
  if (!isPaidGenerateAvailable(ctx.profileId, disabledOptional)) {
    return { kind: 'noop', reason: GENERATION_PLAN_NOT_NEEDED }
  }

  const scenes = scenesFromInput(input.scenes)
  const models = resolveGenerationPlanModelIds(ctx.profileId, input, disabledOptional)
  const videoEnabled = isVideoGenerateAvailable(ctx.profileId, disabledOptional)
  const imageEnabled = isImageGenerateAvailable(ctx.profileId, disabledOptional)
  const runtimeSeconds = input.runtimeSeconds ?? project.intent?.lengthSeconds

  const costEstimateGbp =
    input.costEstimateGbp ??
    estimateGenerationPlanCostGbp({
      scenes,
      runtimeSeconds,
      videoModelId: models.videoModelId,
      imageModelId: models.imageModelId,
      videoEnabled,
      imageEnabled,
    })

  const plan = parseGenerationPlan({
    id: crypto.randomUUID(),
    status: input.status ?? 'draft',
    goal: input.goal ?? project.intent?.goalNote ?? project.intent?.goal,
    angle: input.angle,
    tone: input.tone,
    audience: input.audience ?? audienceLabel(project.intent?.audience),
    runtimeSeconds,
    platform: input.platform ?? intentPlatformLabel(project),
    scenes,
    assetIds: input.assetIds,
    extraExtractUrls: input.extraExtractUrls,
    reExtractThisTurn: input.reExtractThisTurn,
    ...models,
    costEstimateGbp,
    projectRevision: project.revision,
  })

  return { kind: 'plan', plan }
}

export type UpdateGenerationPlanInput = {
  planId: string
  goal?: string
  angle?: string
  tone?: string
  audience?: string
  runtimeSeconds?: number
  platform?: string
  scenes?: unknown[]
  assetIds?: string[]
  extraExtractUrls?: string[]
  reExtractThisTurn?: boolean
  reasonerModelId?: string
  imageModelId?: string
  videoModelId?: string
  costEstimateGbp?: number
  status?: GenerationPlan['status']
}

export type UpdateGenerationPlanResult =
  | { kind: 'noop'; reason: string }
  | { kind: 'error'; error: string }
  | { kind: 'plan'; plan: GenerationPlan; unchanged?: boolean }

export const updateGenerationPlan = (
  project: StudioProject,
  input: UpdateGenerationPlanInput,
  ctx: GenerationPlanToolContext,
): UpdateGenerationPlanResult => {
  const disabledOptional = ctx.disabledOptional ?? []
  if (!isPaidGenerateAvailable(ctx.profileId, disabledOptional)) {
    return { kind: 'noop', reason: GENERATION_PLAN_NOT_NEEDED }
  }

  const existing = project.generationPlan
  if (!existing) {
    return {
      kind: 'error',
      error: 'No Generation Plan on this project. Call draft_generation_plan first.',
    }
  }
  if (existing.id !== input.planId) {
    return {
      kind: 'error',
      error: `Plan id mismatch: project has ${existing.id}, got ${input.planId}.`,
    }
  }
  if (existing.status === 'applied') {
    return { kind: 'error', error: 'Cannot update an applied Generation Plan.' }
  }

  const scenes = input.scenes !== undefined ? scenesFromInput(input.scenes) : existing.scenes
  const models = resolveGenerationPlanModelIds(
    ctx.profileId,
    {
      reasonerModelId: input.reasonerModelId ?? existing.reasonerModelId,
      imageModelId: input.imageModelId ?? existing.imageModelId,
      videoModelId: input.videoModelId ?? existing.videoModelId,
    },
    disabledOptional,
  )
  const videoEnabled = isVideoGenerateAvailable(ctx.profileId, disabledOptional)
  const imageEnabled = isImageGenerateAvailable(ctx.profileId, disabledOptional)
  const runtimeSeconds = input.runtimeSeconds ?? existing.runtimeSeconds

  const costEstimateGbp =
    input.costEstimateGbp ??
    estimateGenerationPlanCostGbp({
      scenes,
      runtimeSeconds,
      videoModelId: models.videoModelId,
      imageModelId: models.imageModelId,
      videoEnabled,
      imageEnabled,
    })

  const nextStatus =
    input.status ?? (existing.projectRevision !== project.revision ? 'stale' : existing.status)

  const merged = parseGenerationPlan({
    ...existing,
    goal: input.goal ?? existing.goal,
    angle: input.angle ?? existing.angle,
    tone: input.tone ?? existing.tone,
    audience: input.audience ?? existing.audience,
    runtimeSeconds,
    platform: input.platform ?? existing.platform,
    scenes,
    assetIds: input.assetIds ?? existing.assetIds,
    extraExtractUrls: input.extraExtractUrls ?? existing.extraExtractUrls,
    reExtractThisTurn: input.reExtractThisTurn ?? existing.reExtractThisTurn,
    ...models,
    status: nextStatus,
    costEstimateGbp,
    projectRevision: project.revision,
  })

  if (JSON.stringify(existing) === JSON.stringify(merged)) {
    return { kind: 'plan', plan: merged, unchanged: true }
  }

  return { kind: 'plan', plan: merged }
}

export const applyGenerationPlanToProject = (
  project: StudioProject,
  plan: GenerationPlan,
): StudioProject => ({
  ...project,
  generationPlan: plan,
})
