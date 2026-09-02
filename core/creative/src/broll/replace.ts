import { pruneMissingSceneClipRefs } from '../intent/mutations'
import { removeClip } from '../project/operations'
import { BROLL_TRACK_ID } from '../project/tracks'
import type { StudioProject } from '../project/schema'

export type FrameRange = { from: number; to: number }

export const rangesOverlap = (a: FrameRange, b: FrameRange): boolean =>
  a.from < b.to && a.to > b.from

const DEFAULT_SCENE_FRAMES = 90

export const sceneWindowFrames = (project: StudioProject, sceneId: string): FrameRange | null => {
  const index = project.scenes.findIndex((scene) => scene.id === sceneId)
  if (index < 0) return null
  const scene = project.scenes[index]!
  const assignedBroll = scene.clipIds
    .map((clipId) => project.clips.find((clip) => clip.id === clipId))
    .filter(
      (clip): clip is NonNullable<typeof clip> => clip != null && clip.trackId === BROLL_TRACK_ID,
    )
  if (assignedBroll.length > 0) {
    const from = Math.min(...assignedBroll.map((clip) => clip.from))
    const to = Math.max(...assignedBroll.map((clip) => clip.from + clip.durationInFrames))
    return { from, to }
  }
  let from = 0
  for (let i = 0; i < index; i += 1) {
    from += project.scenes[i]?.targetDurationFrames ?? DEFAULT_SCENE_FRAMES
  }
  const duration = scene.targetDurationFrames ?? DEFAULT_SCENE_FRAMES
  return { from, to: from + Math.max(1, duration) }
}

export const overlappingBrollClipIds = (project: StudioProject, window: FrameRange): string[] =>
  project.clips
    .filter(
      (clip) =>
        clip.trackId === BROLL_TRACK_ID &&
        rangesOverlap({ from: clip.from, to: clip.from + clip.durationInFrames }, window),
    )
    .map((clip) => clip.id)

/**
 * Remove track_broll clips in the scene window (and assigned B-roll clipIds)
 * so a later place replaces rather than stacks. A-roll is untouched.
 */
export const clearBrollInSceneWindow = (
  project: StudioProject,
  sceneId: string,
  keepClipIds: ReadonlySet<string> = new Set(),
): StudioProject => {
  const window = sceneWindowFrames(project, sceneId)
  if (!window) return project
  const scene = project.scenes.find((item) => item.id === sceneId)
  const assignedBroll = (scene?.clipIds ?? []).filter((clipId) => {
    if (keepClipIds.has(clipId)) return false
    const clip = project.clips.find((item) => item.id === clipId)
    return clip?.trackId === BROLL_TRACK_ID
  })
  const toRemove = [
    ...new Set([...assignedBroll, ...overlappingBrollClipIds(project, window)]),
  ].filter((clipId) => !keepClipIds.has(clipId))
  let next = project
  for (const clipId of toRemove) {
    if (next.clips.some((clip) => clip.id === clipId)) {
      next = removeClip(next, clipId)
    }
  }
  return pruneMissingSceneClipRefs(next)
}
