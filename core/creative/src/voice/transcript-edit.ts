/** Word-level transcript edits for the Studio pane (ADR-0071 / #872). */

import type { TimedCut } from './cut-list'

export type { TimedCut } from './cut-list'

export type TranscriptWord = {
  startMs: number
  endMs: number
  text: string
}

export type ScriptWord = TranscriptWord & { index: number }

const textOf = (row: { text?: unknown }): string => String(row.text ?? '').trim()

const splitTokens = (text: string): string[] => text.split(/\s+/).filter(Boolean)

/** Phrase segments become one word each, with times spread evenly. */
export const expandTranscriptWords = (
  segments: ReadonlyArray<{ startMs: number; endMs: number; text?: string }>,
): ScriptWord[] => {
  const words: ScriptWord[] = []
  for (const segment of segments) {
    const tokens = splitTokens(textOf(segment))
    if (tokens.length === 0) continue
    const span = Math.max(tokens.length * 40, segment.endMs - segment.startMs)
    tokens.forEach((token, offset) => {
      const startMs = segment.startMs + Math.round((offset / tokens.length) * span)
      const endMs = segment.startMs + Math.round(((offset + 1) / tokens.length) * span)
      words.push({
        index: words.length,
        text: token,
        startMs,
        endMs: Math.max(endMs, startMs + 40),
      })
    })
  }
  return words
}

export const wordsOnClip = (
  words: readonly ScriptWord[],
  input: { trimStartMs: number; durationMs: number },
): ScriptWord[] => {
  const start = Math.max(0, input.trimStartMs)
  const end = start + Math.max(0, input.durationMs)
  return words
    .filter((word) => word.endMs > start && word.startMs < end)
    .map((word, index) => ({ ...word, index }))
}

export const wordIndexAtMs = (words: readonly ScriptWord[], playheadMs: number): number | null => {
  if (words.length === 0) return null
  const hit = words.findIndex((word) => playheadMs >= word.startMs && playheadMs < word.endMs)
  if (hit >= 0) return hit
  if (playheadMs < words[0]!.startMs) return 0
  return words.length - 1
}

const clipLocal = (assetMs: number, trimStartMs: number): number =>
  Math.max(0, assetMs - trimStartMs)

export const deleteCutsForWordRange = (input: {
  words: readonly ScriptWord[]
  fromIndex: number
  toIndex: number
  trimStartMs?: number
}): TimedCut[] => {
  const from = Math.max(0, Math.min(input.fromIndex, input.toIndex))
  const to = Math.min(input.words.length - 1, Math.max(input.fromIndex, input.toIndex))
  const start = input.words[from]
  const end = input.words[to]
  if (!start || !end) return []
  const trim = input.trimStartMs ?? 0
  const startMs = clipLocal(start.startMs, trim)
  const endMs = clipLocal(end.endMs, trim)
  if (endMs - startMs < 50) return []
  return [{ startMs, endMs, reason: 'clarity' }]
}

export const trimCutsForWordRange = (input: {
  words: readonly ScriptWord[]
  fromIndex: number
  toIndex: number
  trimStartMs?: number
}): TimedCut[] => {
  if (input.words.length === 0) return []
  const from = Math.max(0, Math.min(input.fromIndex, input.toIndex))
  const to = Math.min(input.words.length - 1, Math.max(input.fromIndex, input.toIndex))
  const trim = input.trimStartMs ?? 0
  const first = input.words[from]!
  const last = input.words[to]!
  const headEnd = clipLocal(first.startMs, trim)
  const tailStart = clipLocal(last.endMs, trim)
  const tailEnd = clipLocal(input.words.at(-1)!.endMs, trim)
  const cuts: TimedCut[] = []
  if (from > 0 && headEnd >= 50) {
    cuts.push({ startMs: 0, endMs: headEnd, reason: 'clarity' })
  }
  if (to < input.words.length - 1 && tailEnd - tailStart >= 50) {
    cuts.push({ startMs: tailStart, endMs: tailEnd, reason: 'clarity' })
  }
  return cuts
}

export const splitFrameForWord = (input: {
  word: ScriptWord
  fps: number
  clipFrom: number
  trimStartMs?: number
}): number => {
  const fps = input.fps > 0 ? input.fps : 30
  const localMs = clipLocal(input.word.startMs, input.trimStartMs ?? 0)
  const frames = Math.max(1, Math.round((localMs / 1000) * fps))
  return input.clipFrom + frames
}

export const playheadMsFromFrame = (frame: number, fps: number): number => {
  const rate = fps > 0 ? fps : 30
  return Math.max(0, Math.round((frame / rate) * 1000))
}
