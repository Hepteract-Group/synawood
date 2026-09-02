/** Timed cut lists — filler, pause, retake, clarity (ADR-0071 / #871). */

import { isFillerText, type TranscriptSegment } from './fillers'
import type { CutRange } from './schema'

export const CUT_REASONS = ['filler', 'pause', 'retake', 'clarity'] as const
export type CutReason = (typeof CUT_REASONS)[number]

export type TimedCut = {
  startMs: number
  endMs: number
  reason: CutReason
}

export const DEFAULT_PAUSE_MS = 600
export const DEFAULT_BREATH_MS = 200

const MIN_CUT_MS = 50
const RETAKE_MIN_WORDS = 3
const RETAKE_MIN_CHARS = 12

export const normalizeSpeech = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isSpeechSegment = (segment: TranscriptSegment): boolean => {
  const trimmed = segment.text.trim()
  return Boolean(trimmed) && !isFillerText(trimmed)
}

const fillerCuts = (segments: readonly TranscriptSegment[]): TimedCut[] => {
  const cuts: TimedCut[] = []
  for (const segment of segments) {
    const trimmed = segment.text.trim()
    if (!trimmed || !isFillerText(trimmed)) continue
    if (segment.endMs <= segment.startMs) continue
    cuts.push({ startMs: segment.startMs, endMs: segment.endMs, reason: 'filler' })
  }
  return cuts
}

const pauseCuts = (
  segments: readonly TranscriptSegment[],
  pauseMs: number,
  breathMs: number,
): TimedCut[] => {
  if (segments.length === 0) return []
  const cuts: TimedCut[] = []
  const first = segments[0]!
  if (first.startMs >= pauseMs) {
    const startMs = Math.min(breathMs, first.startMs)
    if (first.startMs - startMs >= MIN_CUT_MS) {
      cuts.push({ startMs, endMs: first.startMs, reason: 'pause' })
    }
  }
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1]!
    const next = segments[index]!
    const gap = next.startMs - previous.endMs
    if (gap < pauseMs) continue
    const startMs = previous.endMs + breathMs
    if (next.startMs - startMs < MIN_CUT_MS) continue
    cuts.push({ startMs, endMs: next.startMs, reason: 'pause' })
  }
  return cuts
}

const retakeCuts = (segments: readonly TranscriptSegment[]): TimedCut[] => {
  const speech = segments.filter(isSpeechSegment)
  const cuts: TimedCut[] = []
  for (let index = 0; index < speech.length - 1; index += 1) {
    const earlier = speech[index]!
    const later = speech[index + 1]!
    const earlierNorm = normalizeSpeech(earlier.text)
    const laterNorm = normalizeSpeech(later.text)
    if (!earlierNorm || !laterNorm) continue
    const wordCount = earlierNorm.split(' ').length
    if (wordCount < RETAKE_MIN_WORDS && earlierNorm.length < RETAKE_MIN_CHARS) continue
    const repeatedTake = earlierNorm === laterNorm
    const falseStart =
      laterNorm.startsWith(`${earlierNorm} `) && laterNorm.length > earlierNorm.length
    if (!repeatedTake && !falseStart) continue
    cuts.push({ startMs: earlier.startMs, endMs: earlier.endMs, reason: 'retake' })
  }
  return cuts
}

const clarityCuts = (ranges: readonly { startMs: number; endMs: number }[]): TimedCut[] => {
  const cuts: TimedCut[] = []
  for (const range of ranges) {
    if (range.endMs <= range.startMs) continue
    cuts.push({ startMs: range.startMs, endMs: range.endMs, reason: 'clarity' })
  }
  return cuts
}

export const buildCutList = (input: {
  segments: readonly TranscriptSegment[]
  reasons?: readonly CutReason[]
  pauseMs?: number
  breathMs?: number
  clarityRanges?: readonly { startMs: number; endMs: number }[]
}): TimedCut[] => {
  const reasons = input.reasons ?? ['filler', 'pause', 'retake']
  const wants = (reason: CutReason) => reasons.includes(reason)
  const pauseMs = input.pauseMs ?? DEFAULT_PAUSE_MS
  const breathMs = input.breathMs ?? DEFAULT_BREATH_MS
  const cuts: TimedCut[] = []
  if (wants('filler')) cuts.push(...fillerCuts(input.segments))
  if (wants('pause')) cuts.push(...pauseCuts(input.segments, pauseMs, breathMs))
  if (wants('retake')) cuts.push(...retakeCuts(input.segments))
  if (wants('clarity')) cuts.push(...clarityCuts(input.clarityRanges ?? []))
  return cuts.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
}

const STOP_TOKENS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'in',
  'on',
  'to',
  'for',
  'with',
  'about',
  'from',
  'that',
  'this',
  'it',
  'is',
  'are',
  'be',
  'we',
  'you',
  'our',
  'your',
])

const significantTokens = (text: string): Set<string> =>
  new Set(
    normalizeSpeech(text)
      .split(' ')
      .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token)),
  )

const overlapsBrief = (text: string, briefTokens: Set<string>): boolean => {
  for (const token of significantTokens(text)) {
    if (briefTokens.has(token)) return true
  }
  return false
}

/** Off-topic speech vs the brief. Does not invent ranges when the brief is empty. */
export const proposeClarityRanges = (input: {
  segments: readonly TranscriptSegment[]
  briefText: string
}): TimedCut[] => {
  const briefTokens = significantTokens(input.briefText)
  if (briefTokens.size === 0) return []
  const speech = input.segments.filter(isSpeechSegment)
  const hasOnTopic = speech.some((segment) => overlapsBrief(segment.text, briefTokens))
  if (!hasOnTopic) return []
  const cuts: TimedCut[] = []
  for (const segment of speech) {
    if (overlapsBrief(segment.text, briefTokens)) continue
    if (significantTokens(segment.text).size === 0) continue
    const last = cuts.at(-1)
    if (last && last.endMs === segment.startMs) {
      last.endMs = segment.endMs
      continue
    }
    cuts.push({ startMs: segment.startMs, endMs: segment.endMs, reason: 'clarity' })
  }
  return cuts.filter((cut) => cut.endMs - cut.startMs >= MIN_CUT_MS)
}

export const CLARITY_LARGE_SHARE = 0.15

export const isLargeClarityCut = (removedMs: number, durationMs: number): boolean =>
  durationMs > 0 && removedMs / durationMs > CLARITY_LARGE_SHARE

/** Map asset-absolute timed cuts onto a trimmed clip's local clock. */
export const clipLocalTimedCuts = (
  cuts: readonly TimedCut[],
  window: { trimStartMs: number; durationMs: number },
): TimedCut[] => {
  const winStart = Math.max(0, window.trimStartMs)
  const winEnd = winStart + Math.max(0, window.durationMs)
  return cuts.flatMap((cut) => {
    const startMs = Math.max(cut.startMs, winStart) - winStart
    const endMs = Math.min(cut.endMs, winEnd) - winStart
    if (endMs - startMs < MIN_CUT_MS) return []
    return [{ ...cut, startMs, endMs }]
  })
}

export const timedCutsToFrameRanges = (
  cuts: readonly TimedCut[],
  input: { fps: number; clipFrom: number },
): CutRange[] => {
  const fps = input.fps > 0 ? input.fps : 30
  return cuts.map((cut) => {
    const startFrames = Math.max(0, Math.round((cut.startMs / 1000) * fps))
    const endFrames = Math.max(startFrames + 1, Math.round((cut.endMs / 1000) * fps))
    return {
      from: input.clipFrom + startFrames,
      durationInFrames: Math.max(1, endFrames - startFrames),
    }
  })
}

export const isTimedCut = (cut: { startMs?: unknown; from?: unknown }): cut is TimedCut =>
  typeof cut.startMs === 'number' && typeof (cut as TimedCut).endMs === 'number'
