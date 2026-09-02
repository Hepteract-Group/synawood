/** Filler cut lists (ADR-0033 / #220). */

import type { CutRange } from './schema'

const FILLER_RE = /\b(um+|uh+|er+|ah+|hmm+|like|you know)\b/gi

export type TranscriptSegment = { startMs: number; endMs: number; text: string }

export const isFillerText = (text: string): boolean => {
  FILLER_RE.lastIndex = 0
  return FILLER_RE.test(text.trim())
}

/** Build timeline cut ranges from transcript segments that are filler-only. */
export const fillerCutList = (input: {
  segments: readonly TranscriptSegment[]
  fps: number
  clipFrom: number
}): CutRange[] => {
  const fps = input.fps > 0 ? input.fps : 30
  const cuts: CutRange[] = []
  for (const segment of input.segments) {
    const trimmed = segment.text.trim()
    if (!trimmed || !isFillerText(trimmed)) continue
    const startFrames = Math.max(0, Math.round((segment.startMs / 1000) * fps))
    const endFrames = Math.max(startFrames + 1, Math.round((segment.endMs / 1000) * fps))
    cuts.push({
      from: input.clipFrom + startFrames,
      durationInFrames: Math.max(1, endFrames - startFrames),
    })
  }
  return cuts
}
