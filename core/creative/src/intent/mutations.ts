import {
  intentPatchSchema,
  intentSchema,
  parseScenes,
  sceneClipInvariantIssues,
  sceneSchema,
  type Intent,
  type Scene,
  type SceneRole,
} from './schema'
import type { StudioProject } from '../project/schema'
import {
  deriveCreativeStructure,
  parseCreativeStructure,
  type CreativeStructure,
} from './creative-structure'
import { applyDerivedCta } from './cta-from-behaviour'

export type IntentPatch = Partial<Intent>

export type ScenePlan = {
  scenes: Scene[]
  rationale: string
  preserveClipOrder: boolean
}

const nextRevision = (project: StudioProject): number => project.revision + 1

const newSceneId = (): string => `sc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

/** MiniMax stamps confirmSpend onto set_intent. Intent is .strict() — drop unknown keys. */
const pickIntentPatch = (patch: IntentPatch): IntentPatch => {
  const parsed = intentPatchSchema.safeParse(patch)
  if (parsed.success) return parsed.data
  if (!patch || typeof patch !== 'object') return intentPatchSchema.parse(patch)
  const picked: Record<string, unknown> = {}
  for (const key of Object.keys(intentPatchSchema.shape)) {
    if (key in patch) picked[key] = (patch as Record<string, unknown>)[key]
  }
  return intentPatchSchema.parse(picked)
}

export const mergeIntent = (current: Intent, patch: IntentPatch): Intent => {
  const clean = pickIntentPatch(patch)
  const nextAudience =
    clean.audience === undefined
      ? current.audience
      : { ...(current.audience ?? {}), ...clean.audience }
  const withAudience: Intent = {
    ...current,
    ...clean,
    ...(clean.audience !== undefined ? { audience: nextAudience } : {}),
    keywords: clean.keywords ?? current.keywords ?? [],
  }
  const merged = applyDerivedCta(current, clean, withAudience)
  return intentSchema.parse(merged)
}

export const setIntentOnProject = (project: StudioProject, patch: IntentPatch): StudioProject => ({
  ...project,
  intent: mergeIntent(project.intent ?? { keywords: [] }, patch),
  revision: nextRevision(project),
})

export const assertSceneClipInvariants = (scenes: Scene[], project: StudioProject): void => {
  const known = new Set(project.clips.map((clip) => clip.id))
  const issues = sceneClipInvariantIssues(scenes, known)
  if (issues.length > 0) {
    throw new Error(issues.join('; '))
  }
}

export const pruneMissingSceneClipRefs = (project: StudioProject): StudioProject => {
  const known = new Set(project.clips.map((clip) => clip.id))
  const scenes = project.scenes.map((scene) => ({
    ...scene,
    clipIds: scene.clipIds.filter((id) => known.has(id)),
  }))
  if (JSON.stringify(scenes) === JSON.stringify(project.scenes)) {
    return project
  }
  return { ...project, scenes, revision: nextRevision(project) }
}

export const addSceneOnProject = (
  project: StudioProject,
  input: {
    role: SceneRole
    label: string
    intentNote?: string
    targetDurationFrames?: number
    clipIds?: string[]
    overlayIds?: string[]
    locked?: boolean
    index?: number
  },
): StudioProject => {
  const scene = sceneSchema.parse({
    id: newSceneId(),
    role: input.role,
    label: input.label,
    intentNote: input.intentNote,
    targetDurationFrames: input.targetDurationFrames,
    clipIds: input.clipIds ?? [],
    overlayIds: input.overlayIds ?? [],
    locked: input.locked ?? false,
  })
  const scenes = [...project.scenes]
  const index =
    input.index === undefined ? scenes.length : Math.max(0, Math.min(input.index, scenes.length))
  scenes.splice(index, 0, scene)
  assertSceneClipInvariants(scenes, project)
  return { ...project, scenes, revision: nextRevision(project) }
}

export const setSceneOnProject = (
  project: StudioProject,
  input: {
    sceneId: string
    role?: SceneRole
    label?: string
    intentNote?: string | null
    targetDurationFrames?: number | null
    locked?: boolean
  },
): StudioProject => {
  const idx = project.scenes.findIndex((scene) => scene.id === input.sceneId)
  if (idx < 0) {
    throw new Error(`Unknown scene ${input.sceneId}`)
  }
  const prev = project.scenes[idx]!
  const next = sceneSchema.parse({
    ...prev,
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.intentNote === null
      ? { intentNote: undefined }
      : input.intentNote !== undefined
        ? { intentNote: input.intentNote }
        : {}),
    ...(input.targetDurationFrames === null
      ? { targetDurationFrames: undefined }
      : input.targetDurationFrames !== undefined
        ? { targetDurationFrames: input.targetDurationFrames }
        : {}),
    ...(input.locked !== undefined ? { locked: input.locked } : {}),
  })
  const scenes = project.scenes.map((scene, i) => (i === idx ? next : scene))
  return { ...project, scenes, revision: nextRevision(project) }
}

export const removeSceneOnProject = (project: StudioProject, sceneId: string): StudioProject => {
  if (!project.scenes.some((scene) => scene.id === sceneId)) {
    throw new Error(`Unknown scene ${sceneId}`)
  }
  return {
    ...project,
    scenes: project.scenes.filter((scene) => scene.id !== sceneId),
    revision: nextRevision(project),
  }
}

export const reorderScenesOnProject = (
  project: StudioProject,
  sceneIds: string[],
): StudioProject => {
  if (sceneIds.length !== project.scenes.length) {
    throw new Error('reorder_scenes requires every scene id exactly once')
  }
  const byId = new Map(project.scenes.map((scene) => [scene.id, scene]))
  const scenes = sceneIds.map((id) => {
    const scene = byId.get(id)
    if (!scene) {
      throw new Error(`Unknown scene ${id}`)
    }
    return scene
  })
  if (new Set(sceneIds).size !== sceneIds.length) {
    throw new Error('reorder_scenes sceneIds must be unique')
  }
  return { ...project, scenes, revision: nextRevision(project) }
}

/** Move a clip into a scene (or unassign with sceneId null). Enforces one scene per clip. */
export const assignClipToSceneOnProject = (
  project: StudioProject,
  input: { clipId: string; sceneId: string | null },
): StudioProject => {
  if (!project.clips.some((clip) => clip.id === input.clipId)) {
    throw new Error(`Unknown clip ${input.clipId}`)
  }
  if (input.sceneId !== null && !project.scenes.some((scene) => scene.id === input.sceneId)) {
    throw new Error(`Unknown scene ${input.sceneId}`)
  }
  const scenes = project.scenes.map((scene) => {
    const without = scene.clipIds.filter((id) => id !== input.clipId)
    if (input.sceneId !== null && scene.id === input.sceneId) {
      return { ...scene, clipIds: [...without, input.clipId] }
    }
    return { ...scene, clipIds: without }
  })
  assertSceneClipInvariants(scenes, project)
  return { ...project, scenes, revision: nextRevision(project) }
}

export const replaceScenesOnProject = (
  project: StudioProject,
  scenesInput: unknown,
): StudioProject => {
  const scenes = parseScenes(scenesInput)
  assertSceneClipInvariants(scenes, project)
  return { ...project, scenes, revision: nextRevision(project) }
}

const DEFAULT_STORY_ROLES: SceneRole[] = ['hook', 'problem', 'solution', 'cta']

const roleLabel = (role: SceneRole, intent: Intent): string => {
  switch (role) {
    case 'hook':
      return intent.cta ? `Hook - lead to "${intent.cta}"` : 'Hook'
    case 'problem':
      return 'Problem'
    case 'solution':
      return intent.goal === 'signup' ? 'Solution - product payoff' : 'Solution'
    case 'cta':
      return intent.cta ? `CTA - ${intent.cta}` : 'CTA'
    default:
      return role.charAt(0).toUpperCase() + role.slice(1)
  }
}

/**
 * Deterministic ScenePlan (no reasoner). Splits ordered video-track clips across
 * a hook → problem → solution → cta skeleton when preserveClipOrder is true.
 */
export const planScenesHeuristic = (
  project: StudioProject,
  input: { preserveClipOrder?: boolean } = {},
): ScenePlan => {
  const preserveClipOrder = input.preserveClipOrder !== false
  const intent = project.intent ?? { keywords: [] }
  const videoTrackId = project.tracks.find((track) => track.type === 'video')?.id
  const orderedClips = [...project.clips]
    .filter((clip) => !videoTrackId || clip.trackId === videoTrackId)
    .sort((a, b) => a.from - b.from)

  if (orderedClips.length === 0) {
    const scenes = DEFAULT_STORY_ROLES.map((role) =>
      sceneSchema.parse({
        id: newSceneId(),
        role,
        label: roleLabel(role, intent),
        clipIds: [],
        targetDurationFrames:
          intent.lengthSeconds && project.fps
            ? Math.max(
                1,
                Math.round((intent.lengthSeconds * project.fps) / DEFAULT_STORY_ROLES.length),
              )
            : undefined,
      }),
    )
    return {
      scenes,
      rationale: 'Empty timeline — drafted a four-beat story skeleton from Intent.',
      preserveClipOrder,
    }
  }

  const roles = DEFAULT_STORY_ROLES
  const bucketCount = Math.min(roles.length, orderedClips.length)
  const activeRoles = roles.slice(0, bucketCount)
  const buckets: string[][] = activeRoles.map(() => [])
  orderedClips.forEach((clip, index) => {
    const bucket = Math.min(
      activeRoles.length - 1,
      Math.floor((index / orderedClips.length) * activeRoles.length),
    )
    buckets[bucket]!.push(clip.id)
  })

  const scenes = activeRoles.map((role, i) => {
    const clipIds = buckets[i]!
    const duration = clipIds.reduce((sum, clipId) => {
      const clip = project.clips.find((c) => c.id === clipId)
      return sum + (clip?.durationInFrames ?? 0)
    }, 0)
    return sceneSchema.parse({
      id: newSceneId(),
      role,
      label: roleLabel(role, intent),
      clipIds,
      targetDurationFrames: duration > 0 ? duration : undefined,
    })
  })

  return {
    scenes,
    rationale: preserveClipOrder
      ? `Assigned ${orderedClips.length} clip(s) in timeline order across ${scenes.length} story beats.`
      : `Drafted ${scenes.length} story beats from Intent and current clips.`,
    preserveClipOrder,
  }
}

export const deriveCreativeStructureOnProject = (project: StudioProject): StudioProject => ({
  ...project,
  creativeStructure: deriveCreativeStructure({
    scenes: project.scenes,
    clips: project.clips,
  }),
  revision: nextRevision(project),
})

export const setCreativeStructureOnProject = (
  project: StudioProject,
  structure: CreativeStructure,
): StudioProject => ({
  ...project,
  creativeStructure: parseCreativeStructure({ ...structure, source: 'manual' }),
  revision: nextRevision(project),
})
