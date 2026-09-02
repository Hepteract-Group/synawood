/** Apply filler/silence/retake cut ranges on a clip (ADR-0033 / ADR-0071). */

import { autoFitDuration, rippleDeleteClip, splitClip } from '../project/operations'
import type { ProjectOverlay, StudioProject } from '../project/schema'
import { studioProjectSchema } from '../project/schema'
import { appendWhyLog, secondsAtFrame } from '../project/why-log'
import { isTimedCut, timedCutsToFrameRanges, type TimedCut } from './cut-list'
import type { CutRange } from './schema'

const clipContains = (clip: { from: number; durationInFrames: number }, frame: number): boolean =>
  frame > clip.from && frame < clip.from + clip.durationInFrames

const rippleOverlaysForCut = (
  overlays: readonly ProjectOverlay[],
  cutFrom: number,
  durationInFrames: number,
): ProjectOverlay[] => {
  const cutEnd = cutFrom + durationInFrames
  return overlays.flatMap((overlay) => {
    const overlayEnd = overlay.from + overlay.durationInFrames
    if (overlayEnd <= cutFrom) return [overlay]
    if (overlay.from >= cutEnd) {
      return [{ ...overlay, from: overlay.from - durationInFrames }]
    }
    if (overlay.from >= cutFrom && overlayEnd <= cutEnd) return []
    if (overlay.from < cutFrom && overlayEnd > cutEnd) {
      const nextDuration = overlay.durationInFrames - durationInFrames
      return nextDuration > 0 ? [{ ...overlay, durationInFrames: nextDuration }] : []
    }
    if (overlay.from < cutFrom) {
      const nextDuration = cutFrom - overlay.from
      return nextDuration > 0 ? [{ ...overlay, durationInFrames: nextDuration }] : []
    }
    const remaining = overlayEnd - cutEnd
    return remaining > 0 ? [{ ...overlay, from: cutFrom, durationInFrames: remaining }] : []
  })
}

const toFrameCuts = (
  project: StudioProject,
  clipId: string,
  cuts: readonly (CutRange | TimedCut)[],
): CutRange[] => {
  const clip = project.clips.find((item) => item.id === clipId)
  if (!clip) throw new Error(`Unknown clip: ${clipId}`)
  const fps = project.fps > 0 ? project.fps : 30
  return cuts.map((cut) =>
    isTimedCut(cut) ? timedCutsToFrameRanges([cut], { fps, clipFrom: clip.from })[0]! : cut,
  )
}

export const cutWhyReason = (cuts: readonly (CutRange | TimedCut)[]): string => {
  const timed = cuts.filter(isTimedCut)
  if (timed.length > 0 && timed.every((cut) => cut.reason === 'pause')) {
    return 'Removed silence and kept a short breath.'
  }
  if (timed.length > 0 && timed.every((cut) => cut.reason === 'retake')) {
    return 'Removed the false start and kept the last take.'
  }
  if (timed.length > 0 && timed.every((cut) => cut.reason === 'clarity')) {
    return 'Cut rambling from this take.'
  }
  return cuts.length === 1
    ? 'Cut a range from the talking-head take.'
    : `Removed ${cuts.length} ranges from the talking-head take.`
}

/**
 * Split out each cut range (later first) and ripple-delete the middle piece.
 * Ranges must lie inside the target clip. Captions and other overlays in the
 * window shift or drop with the picture.
 */
export const applyCutList = (
  project: StudioProject,
  clipId: string,
  cuts: readonly (CutRange | TimedCut)[],
): StudioProject => {
  const frameCuts = toFrameCuts(project, clipId, cuts)
  const ordered = [...frameCuts].sort((a, b) => b.from - a.from)
  const clip = project.clips.find((item) => item.id === clipId)
  const firstCut = ordered.at(-1)
  if (ordered.length === 0) return project
  let next = project
  for (const cut of ordered) {
    const clip = next.clips.find((item) => item.id === clipId)
    if (!clip) throw new Error(`Unknown clip: ${clipId}`)
    const cutEnd = cut.from + cut.durationInFrames
    const clipEnd = clip.from + clip.durationInFrames
    if (cut.from < clip.from || cutEnd > clipEnd) {
      throw new Error('Cut range must sit inside the clip.')
    }
    let workingId = clip.id
    if (clipContains(clip, cutEnd)) {
      next = splitClip(next, workingId, cutEnd)
    }
    const afterSplit = next.clips.find((item) => item.id === workingId)
    if (afterSplit && clipContains(afterSplit, cut.from)) {
      next = splitClip(next, workingId, cut.from)
      const mid = next.clips.find(
        (item) =>
          item.trackId === clip.trackId &&
          item.from === cut.from &&
          item.durationInFrames === cut.durationInFrames,
      )
      if (!mid) throw new Error('Could not isolate cut range.')
      workingId = mid.id
    } else {
      const mid = next.clips.find((item) => item.trackId === clip.trackId && item.from === cut.from)
      if (!mid) throw new Error('Could not isolate cut range.')
      workingId = mid.id
    }
    next = rippleDeleteClip(next, workingId)
    next = autoFitDuration(
      studioProjectSchema.parse({
        ...next,
        overlays: rippleOverlaysForCut(next.overlays, cut.from, cut.durationInFrames),
      }),
    )
  }
  const at = firstCut
    ? secondsAtFrame(project, firstCut.from)
    : secondsAtFrame(project, clip?.from ?? 0)
  return appendWhyLog(next, {
    t: at,
    target: clipId,
    action: 'cut',
    reason: cutWhyReason(cuts),
  })
}
