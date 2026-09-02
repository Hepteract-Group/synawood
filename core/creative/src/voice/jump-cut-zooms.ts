/** Zoom punch on filler/false-start splices so the jump does not flash (ADR-0073 / #884). */

import { applyEffectToClip } from '../effects/apply'
import type { StudioProject } from '../project/schema'
import { MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import { appendWhyLog, secondsAtFrame } from '../project/why-log'
import { isTimedCut, timedCutsToFrameRanges, type TimedCut } from './cut-list'
import type { CutRange } from './schema'

export const JUMP_CUT_ZOOM_INTENSITY = 0.65

const JUMP_CUT_REASONS = new Set(['filler', 'retake'])

const spliceFramesAfterCuts = (frameCuts: readonly CutRange[]): number[] => {
  const earlyFirst = [...frameCuts].sort((left, right) => left.from - right.from)
  let removed = 0
  return earlyFirst.map((cut) => {
    const splice = cut.from - removed
    removed += cut.durationInFrames
    return splice
  })
}

export const applyJumpCutZooms = (
  project: StudioProject,
  input: { clipFrom: number; cuts: readonly TimedCut[] },
): StudioProject => {
  const fps = project.fps > 0 ? project.fps : 30
  const relevant = input.cuts.filter((cut) => isTimedCut(cut) && JUMP_CUT_REASONS.has(cut.reason))
  if (relevant.length === 0) return project
  const frameCuts = timedCutsToFrameRanges(relevant, { fps, clipFrom: input.clipFrom })
  const splices = new Set(spliceFramesAfterCuts(frameCuts))
  const targets = project.clips.filter(
    (clip) => clip.trackId === MAIN_VIDEO_TRACK_ID && splices.has(clip.from),
  )
  if (targets.length === 0) return project
  let next = project
  for (const clip of targets) {
    if (clip.treatments?.some((item) => item.id === 'zoom_punch')) continue
    next = applyEffectToClip(next, {
      clipId: clip.id,
      effectId: 'zoom_punch',
      intensity: JUMP_CUT_ZOOM_INTENSITY,
    })
  }
  const at = secondsAtFrame(project, targets[0]!.from)
  return appendWhyLog(next, {
    t: at,
    target: targets[0]!.id,
    action: 'effect',
    reason: 'Added a small zoom so the jump does not flash.',
  })
}
