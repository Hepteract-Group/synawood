import { TIMELINE_FPS } from './timelineMath'

/** Nice second steps for major ruler labels (snapped for zoom). */
const NICE_SECONDS = [1 / 30, 2 / 30, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]

export type RulerTick = {
  frame: number
  major: boolean
  label: string | null
}

/** Choose a major step so labels sit ~targetPx apart at the current zoom. */
export const pickMajorStepFrames = (
  pixelsPerFrame: number,
  fps = TIMELINE_FPS,
  targetPx = 96,
): number => {
  const ppf = Math.max(0.05, pixelsPerFrame)
  const idealFrames = targetPx / ppf
  let best = fps
  let bestScore = Number.POSITIVE_INFINITY
  for (const seconds of NICE_SECONDS) {
    const frames = Math.max(1, Math.round(seconds * fps))
    const score = Math.abs(frames - idealFrames)
    if (score < bestScore) {
      bestScore = score
      best = frames
    }
  }
  return best
}

/** Compact continuous labels that densify as the user zooms in. */
export const formatRulerLabel = (
  frame: number,
  majorStepFrames: number,
  fps = TIMELINE_FPS,
): string => {
  const safe = Math.max(0, Math.floor(frame))
  const totalSeconds = safe / fps
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60

  if (majorStepFrames >= fps * 60) {
    return `${minutes}:${String(Math.floor(seconds)).padStart(2, '0')}`
  }
  if (majorStepFrames >= fps) {
    return `${minutes}:${String(Math.floor(seconds)).padStart(2, '0')}`
  }
  if (majorStepFrames >= fps / 10) {
    return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
  }
  const wholeSeconds = Math.floor(totalSeconds)
  const frames = safe % fps
  const m = Math.floor(wholeSeconds / 60)
  const s = wholeSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
}

/**
 * Continuous ruler ticks from 0 through endFrame (inclusive), adapting density
 * to zoom so horizontal scroll feels like an infinite time strip.
 */
export const buildRulerTicks = (input: {
  endFrame: number
  pixelsPerFrame: number
  fps?: number
}): RulerTick[] => {
  const fps = input.fps ?? TIMELINE_FPS
  const endFrame = Math.max(0, Math.ceil(input.endFrame))
  const major = pickMajorStepFrames(input.pixelsPerFrame, fps)
  const minor = Math.max(1, Math.round(major / 5))
  const ticks: RulerTick[] = []

  for (let frame = 0; frame <= endFrame; frame += minor) {
    const isMajor = frame % major === 0
    ticks.push({
      frame,
      major: isMajor,
      label: isMajor ? formatRulerLabel(frame, major, fps) : null,
    })
  }

  if (ticks.length === 0 || ticks[ticks.length - 1]!.frame !== endFrame) {
    const isMajor = endFrame % major === 0
    ticks.push({
      frame: endFrame,
      major: isMajor,
      label: isMajor ? formatRulerLabel(endFrame, major, fps) : null,
    })
  }

  return ticks
}

/** Extra frames past project length so the strip keeps ticking into empty space. */
export const trailingRulerFrames = (pixelsPerFrame: number, trailPx = 520): number =>
  Math.max(Math.round(trailPx / Math.max(0.05, pixelsPerFrame)), TIMELINE_FPS * 2)
