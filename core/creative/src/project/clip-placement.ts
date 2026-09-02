import type { StudioProject } from './schema'

type PlacementInput = {
  trackId: string
  from: number
  durationInFrames: number
  excludeClipId?: string
}

/**
 * Prefer free placement at `from`. On overlap with a track sibling, magnetically
 * abut that sibling: attempt nearer the target's start → place ending at its
 * start (when there is room); nearer its end → place starting at its end.
 * Walks until the range is free.
 */
export const resolveMagneticClipFrom = (project: StudioProject, input: PlacementInput): number => {
  let from = Math.max(0, Math.floor(input.from))
  const durationInFrames = Math.max(1, Math.floor(input.durationInFrames))
  const clips = project.clips
    .filter((clip) => clip.trackId === input.trackId && clip.id !== input.excludeClipId)
    .slice()
    .sort((a, b) => a.from - b.from || a.id.localeCompare(b.id))

  for (let guard = 0; guard <= clips.length + 2; guard += 1) {
    const to = from + durationInFrames
    const collision = clips.find(
      (clip) => clip.from < to && clip.from + clip.durationInFrames > from,
    )
    if (!collision) return from

    const targetStart = collision.from
    const targetEnd = collision.from + collision.durationInFrames
    const probe = from + durationInFrames / 2
    const targetMid = (targetStart + targetEnd) / 2
    const preferBefore = probe < targetMid
    const before = targetStart - durationInFrames

    if (preferBefore && before >= 0) {
      from = before
      continue
    }
    from = targetEnd
  }
  return from
}
