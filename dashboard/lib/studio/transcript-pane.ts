import {
  expandTranscriptWords,
  playheadMsFromFrame,
  wordIndexAtMs,
  wordsOnClip,
  type ScriptWord,
} from '@synawood/creative/voice/transcript-edit'
import {
  buildCutList,
  clipLocalTimedCuts,
  proposeClarityRanges,
  type TimedCut,
} from '@synawood/creative/voice/cut-list'

const timedCutsFromTranscript = (
  segments: Array<{ startMs: number; endMs: number; text?: string }>,
  reasons: Array<'pause' | 'retake'>,
  window: { trimStartMs: number; durationMs: number },
): TimedCut[] =>
  clipLocalTimedCuts(
    buildCutList({
      segments: segments.map((segment) => ({
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text ?? '',
      })),
      reasons,
    }),
    window,
  )

export const PAUSE_EMPTY_COPY = 'No long pauses in this take.'

export const pauseCutsForTranscript = (input: {
  segments: Array<{ startMs: number; endMs: number; text?: string }>
  trimStartMs: number
  durationMs: number
}): TimedCut[] =>
  timedCutsFromTranscript(input.segments, ['pause'], {
    trimStartMs: input.trimStartMs,
    durationMs: input.durationMs,
  })

export const RETAKE_EMPTY_COPY = 'No false starts in this take.'

export const retakeCutsForTranscript = (input: {
  segments: Array<{ startMs: number; endMs: number; text?: string }>
  trimStartMs: number
  durationMs: number
}): TimedCut[] =>
  timedCutsFromTranscript(input.segments, ['retake'], {
    trimStartMs: input.trimStartMs,
    durationMs: input.durationMs,
  })

export const CLARITY_EMPTY_NO_BRIEF = 'Add a brief first so we know what is off-topic.'
export const CLARITY_EMPTY_COPY = 'No rambling in this take.'

export const briefTextFromProject = (brief: unknown): string => {
  if (!brief || typeof brief !== 'object') return ''
  const record = brief as {
    product?: { name?: string; oneLiner?: string; benefits?: string[] }
    messaging?: { hookCandidates?: string[]; ctaCandidates?: string[] }
  }
  return [
    record.product?.name,
    record.product?.oneLiner,
    ...(record.product?.benefits ?? []),
    ...(record.messaging?.hookCandidates ?? []),
    ...(record.messaging?.ctaCandidates ?? []),
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
}

export const clarityCutsForTranscript = (input: {
  segments: Array<{ startMs: number; endMs: number; text?: string }>
  briefText: string
  trimStartMs: number
  durationMs: number
}): TimedCut[] =>
  clipLocalTimedCuts(
    proposeClarityRanges({
      segments: input.segments.map((segment) => ({
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text ?? '',
      })),
      briefText: input.briefText,
    }),
    { trimStartMs: input.trimStartMs, durationMs: input.durationMs },
  )

export type TranscriptPaneView =
  | { kind: 'collapsed' }
  | { kind: 'no-clip' }
  | { kind: 'transcribe'; busy: boolean }
  | { kind: 'script'; words: ScriptWord[]; activeIndex: number | null }

export const pickTranscriptPaneView = (input: {
  collapsed: boolean
  clipId: string | null
  segments: Array<{ startMs: number; endMs: number; text?: string }>
  trimStartMs: number
  durationMs: number
  playheadFrame: number
  fps: number
  transcribing: boolean
}): TranscriptPaneView => {
  if (input.collapsed) return { kind: 'collapsed' }
  if (!input.clipId) return { kind: 'no-clip' }
  const words = wordsOnClip(expandTranscriptWords(input.segments), {
    trimStartMs: input.trimStartMs,
    durationMs: input.durationMs,
  })
  if (words.length === 0) return { kind: 'transcribe', busy: input.transcribing }
  const playheadMs = playheadMsFromFrame(input.playheadFrame, input.fps) + input.trimStartMs
  return {
    kind: 'script',
    words,
    activeIndex: wordIndexAtMs(words, playheadMs),
  }
}

/** ADR-0071: operator-marked rambling over 15% of the take needs a confirm modal. */
export const needsClarityConfirm = (removedMs: number, clipDurationMs: number): boolean =>
  clipDurationMs > 0 && removedMs / clipDurationMs > 0.15

export const readAssetTranscriptSegments = (
  probe: Record<string, unknown> | undefined,
): Array<{ startMs: number; endMs: number; text: string }> => {
  const raw = probe?.transcriptSegments
  if (!Array.isArray(raw)) return []
  return raw.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const record = row as { startMs?: unknown; endMs?: unknown; text?: unknown }
    const text = String(record.text ?? '').trim()
    if (!text) return []
    return [{ startMs: Number(record.startMs) || 0, endMs: Number(record.endMs) || 0, text }]
  })
}
