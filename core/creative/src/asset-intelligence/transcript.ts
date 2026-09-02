/** Wave 2C / #167 — index transcript stage (reuse Whisper / profile transcribe). */

import { transcribeMedia } from '../generators/transcribe'

export const MAX_TRANSCRIPT_EXCERPT = 2_000

export type TranscriptSegment = {
  startMs: number
  endMs: number
  text: string
}

export const excerptTranscript = (text: string): string => {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= MAX_TRANSCRIPT_EXCERPT) return trimmed
  return `${trimmed.slice(0, MAX_TRANSCRIPT_EXCERPT - 1).trimEnd()}…`
}

export const normalizeTranscriptPhrase = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')

/** Words/segments that overlap a Shot window (inclusive start, exclusive-or-open end). */
export const transcriptWindowForShot = (
  shot: { startMs: number; endMs: number | null },
  segments: readonly TranscriptSegment[],
): string | null => {
  if (segments.length === 0) return null
  const end = shot.endMs ?? Number.POSITIVE_INFINITY
  const texts = segments
    .filter((seg) => seg.endMs > shot.startMs && seg.startMs < end)
    .map((seg) => seg.text.trim())
    .filter(Boolean)
  if (texts.length === 0) return null
  return excerptTranscript(texts.join(' '))
}

export const shotWindowContainsPhrase = (window: string | null, query: string): boolean => {
  if (!window) return false
  const hay = normalizeTranscriptPhrase(window)
  const needle = normalizeTranscriptPhrase(query)
  if (!needle) return false
  return hay.includes(needle)
}

export type TranscribeAssetResult =
  | { skipped: false; transcriptExcerpt: string; segments: TranscriptSegment[] }
  | { skipped: true; reason: string }

/**
 * STT for video/audio index rows. Images/other skip (no speech track).
 * Soft-fail belongs to the orchestrator — this throws on real STT errors.
 */
export const transcribeAssetForIndex = async (
  input: {
    assetId: string
    modelId: string
    kind: 'video' | 'image' | 'audio' | 'other'
    mediaType: string
    fileName: string
    bytes: Buffer
  },
  deps?: {
    transcribeMedia?: typeof transcribeMedia
  },
): Promise<TranscribeAssetResult> => {
  if (input.kind === 'image' || input.kind === 'other') {
    return {
      skipped: true,
      reason: 'transcribe skipped: no speech track on image/other assets',
    }
  }

  const run = deps?.transcribeMedia ?? transcribeMedia
  const result = await run({
    audioAssetId: input.assetId,
    modelId: input.modelId,
    audioBytes: input.bytes,
    mediaType: input.mediaType,
    fileName: input.fileName,
  })
  const transcriptExcerpt = excerptTranscript(result.text)
  if (!transcriptExcerpt) {
    return {
      skipped: true,
      reason: 'transcribe skipped: empty transcript',
    }
  }
  const segments: TranscriptSegment[] = (result.segments ?? [])
    .filter((seg) => Number.isFinite(seg.startMs) && Number.isFinite(seg.endMs))
    .map((seg) => ({
      startMs: Math.max(0, Math.round(seg.startMs)),
      endMs: Math.max(0, Math.round(seg.endMs)),
      text: seg.text.trim(),
    }))
    .filter((seg) => seg.text.length > 0 && seg.endMs >= seg.startMs)
  return { skipped: false, transcriptExcerpt, segments }
}
