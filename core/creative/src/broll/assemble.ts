import { createHash } from 'node:crypto'
import type { MomentHit } from '../asset-intelligence/moments'
import type { Scene } from '../intent/schema'
import { isToolEnabled, resolveModelRef } from '../model-profiles'
import { estimateGbp } from '../pricing'
import type { StudioProject } from '../project/schema'
import { brollPlanSchema, type BrollPlan, type BrollPlanRow } from './schema'

export const VIDEO_PROFILE_SWITCH_COPY =
  'Video generation is off. I will not fake an ad with stills. Turn a video model on in the Video picker, then ask again.'

export const BRAND_REQUIRED_COPY = 'Import Brand kit in Brand Studio before generating new clips.'

const DEFAULT_CLIP_SECONDS = 4
const MAX_FILL_SECONDS = 4

export type AssembleBrollInput = {
  sceneIds?: string[]
  dryRun?: boolean
}

export const hashAssembleBrollInput = (
  projectId: string,
  projectRevision: number,
  input: AssembleBrollInput,
): string => {
  const payload = JSON.stringify({
    projectId,
    projectRevision,
    sceneIds: input.sceneIds ?? null,
    dryRun: input.dryRun !== false,
  })
  return createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

export const scenesToCover = (project: StudioProject, sceneIds?: string[]): Scene[] => {
  const selected = sceneIds?.length
    ? project.scenes.filter((scene) => sceneIds.includes(scene.id))
    : project.scenes
  if (selected.length > 0) return selected
  const lengthSeconds = project.intent.lengthSeconds ?? 30
  return [
    {
      id: 'scene_default',
      role: 'custom',
      label: 'Picture',
      clipIds: [],
      overlayIds: [],
      locked: false,
      targetDurationFrames: Math.max(1, Math.round(lengthSeconds * 30)),
    },
  ]
}

export const queryForScene = (project: StudioProject, scene: Scene): string => {
  const keywords = project.intent.keywords?.join(' ') ?? ''
  return [scene.role, scene.label, scene.intentNote ?? '', keywords].join(' ').trim() || scene.role
}

const clipSecondsForScene = (scene: Scene): number => {
  if (scene.targetDurationFrames && scene.targetDurationFrames > 0) {
    return Math.min(MAX_FILL_SECONDS, Math.max(1, Math.round(scene.targetDurationFrames / 30)))
  }
  return DEFAULT_CLIP_SECONDS
}

const generatePromptForScene = (project: StudioProject, scene: Scene): string => {
  const keywords = project.intent.keywords?.join(', ') || scene.label
  return `Branded ${scene.role} picture for ${project.productId}: ${keywords}`
}

const audioTrackHasClips = (project: StudioProject): boolean => {
  const audioTrackId = project.tracks.find((track) => track.type === 'audio')?.id ?? 'track_audio'
  return project.clips.some((clip) => clip.trackId === audioTrackId)
}

export const wantsMusicBed = (project: StudioProject): boolean => {
  if (audioTrackHasClips(project)) return false
  // VO-only talking-head polish: no music unless Intent asked for a ≥30s ad.
  if (project.compositionId === 'talking-head-60' && (project.intent.lengthSeconds ?? 0) < 30) {
    return false
  }
  return true
}

const musicSeconds = (project: StudioProject): number => {
  if (project.intent.lengthSeconds && project.intent.lengthSeconds > 0) {
    return Math.round(project.intent.lengthSeconds)
  }
  const end = Math.max(0, ...project.clips.map((clip) => clip.from + clip.durationInFrames))
  if (end > 0) return Math.max(1, Math.round(end / 30))
  return 30
}

export type BuildBrollPlanInput = {
  project: StudioProject
  modelProfileId: string
  sceneIds?: string[]
  momentsByScene: Record<string, MomentHit[]>
  now?: Date
  planId?: string
}

/**
 * Heuristic BrollPlan: one library Moment per scene when ranked hits exist,
 * otherwise a generate-to-fill row. Optional music when the audio track is empty.
 * Never mutates clips.
 */
export const buildBrollPlan = (input: BuildBrollPlanInput): BrollPlan => {
  const scenes = scenesToCover(input.project, input.sceneIds)
  const videoEnabled = isToolEnabled(input.modelProfileId, 'generate_video_clip')
  const imageEnabled = isToolEnabled(input.modelProfileId, 'generate_image')
  const videoModelId = videoEnabled ? resolveModelRef(input.modelProfileId, 'video').modelId : null
  const imageModelId = imageEnabled ? resolveModelRef(input.modelProfileId, 'image').modelId : null
  const musicModelId = resolveModelRef(input.modelProfileId, 'music').modelId
  const brandStillId =
    input.project.brand?.stillAssetIds?.[0] ??
    input.project.brand?.stillAssetId ??
    input.project.brand?.logoAssetId
  const hasBrand = Boolean(input.project.brand)

  const usedShots = new Set<string>()
  const rows: BrollPlanRow[] = []

  for (const scene of scenes) {
    const hits = (input.momentsByScene[scene.id] ?? []).filter((hit) => !usedShots.has(hit.shotId))
    const best = hits[0]
    if (best) {
      usedShots.add(best.shotId)
      rows.push({
        kind: 'moment',
        id: `moment_${scene.id}`,
        sceneId: scene.id,
        sceneRole: scene.role,
        assetId: best.assetId,
        shotId: best.shotId,
        startMs: best.startMs,
        endMs: best.endMs,
        score: best.score,
        caption: best.caption,
        estimatedGbp: 0,
      })
      continue
    }

    const durationSeconds = Math.min(MAX_FILL_SECONDS, clipSecondsForScene(scene))
    const media: 'video' | 'image' = videoEnabled ? 'video' : 'image'
    const blockedReason = !hasBrand
      ? BRAND_REQUIRED_COPY
      : media === 'video' && !videoEnabled
        ? VIDEO_PROFILE_SWITCH_COPY
        : media === 'image' && !imageEnabled
          ? VIDEO_PROFILE_SWITCH_COPY
          : undefined
    const estimatedGbp = blockedReason
      ? 0
      : media === 'video' && videoModelId
        ? estimateGbp(videoModelId, durationSeconds)
        : media === 'image' && imageModelId
          ? estimateGbp(imageModelId, 1)
          : 0
    if (media === 'image') {
      const libraryStillId = input.project.assets.find((asset) => asset.kind === 'image')?.id
      if (libraryStillId) {
        rows.push({
          kind: 'still',
          id: `still_${scene.id}`,
          sceneId: scene.id,
          sceneRole: scene.role,
          prompt: generatePromptForScene(input.project, scene),
          sourceImageAssetId: libraryStillId,
          estimatedGbp: 0,
        })
        continue
      }
      rows.push({
        kind: 'still',
        id: `still_${scene.id}`,
        sceneId: scene.id,
        sceneRole: scene.role,
        prompt: generatePromptForScene(input.project, scene),
        ...(brandStillId ? { sourceImageAssetId: brandStillId } : {}),
        estimatedGbp,
        ...(blockedReason ? { blockedReason } : {}),
      })
      continue
    }
    rows.push({
      kind: 'generate',
      id: `generate_${scene.id}`,
      sceneId: scene.id,
      sceneRole: scene.role,
      media: 'video',
      prompt: generatePromptForScene(input.project, scene),
      durationSeconds,
      ...(brandStillId ? { sourceImageAssetId: brandStillId } : {}),
      estimatedGbp,
      ...(blockedReason ? { blockedReason } : {}),
    })
  }

  if (wantsMusicBed(input.project) && isToolEnabled(input.modelProfileId, 'generate_music')) {
    const durationSeconds = musicSeconds(input.project)
    rows.push({
      kind: 'music',
      id: 'music_bed',
      prompt: `Instrumental bed for ${input.project.productId} ${input.project.intent.emotion ?? 'calm'} ad`,
      durationSeconds,
      estimatedGbp: estimateGbp(musicModelId, durationSeconds),
    })
  }

  const estimatedGbp = Number(rows.reduce((sum, row) => sum + row.estimatedGbp, 0).toFixed(4))
  const momentCount = rows.filter((row) => row.kind === 'moment').length
  const fillCount = rows.filter((row) => row.kind === 'generate' || row.kind === 'still').length
  const rationale =
    fillCount === 0
      ? `Using ${momentCount} clip${momentCount === 1 ? '' : 's'} from your library.`
      : momentCount === 0
        ? `Nothing in the library matched. ${fillCount} new clip${fillCount === 1 ? '' : 's'} to generate.`
        : `Using ${momentCount} clip${momentCount === 1 ? '' : 's'} from your library. ${fillCount} new clip${fillCount === 1 ? '' : 's'} to generate.`

  return brollPlanSchema.parse({
    id: input.planId ?? crypto.randomUUID(),
    createdAt: (input.now ?? new Date()).toISOString(),
    projectRevision: input.project.revision,
    sceneIds: scenes.map((scene) => scene.id),
    rows,
    estimatedGbp,
    status: 'draft',
    rationale,
  })
}
