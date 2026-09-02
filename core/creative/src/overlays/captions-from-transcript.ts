import type { StudioProject } from '../project/schema'
import { addCaptions } from '../project/operations'
import { applyCaptionEmphasis } from './caption-emphasis'

export type TranscriptWord = {
  startMs: number
  endMs: number
  text: string
}

const MAX_CHARS = 42

export const chunkTranscriptCaptions = (
  words: TranscriptWord[],
  fps: number,
): Array<{
  text: string
  from: number
  durationInFrames: number
  words: TranscriptWord[]
}> => {
  const cleaned = words
    .map((word) => ({
      startMs: word.startMs,
      endMs: Math.max(word.endMs, word.startMs + 80),
      text: word.text.trim(),
    }))
    .filter((word) => word.text.length > 0)
  if (cleaned.length === 0) return []

  const chunks: Array<{
    text: string
    from: number
    durationInFrames: number
    words: TranscriptWord[]
  }> = []
  let current: TranscriptWord[] = []
  let chars = 0
  const flush = () => {
    if (current.length === 0) return
    const startMs = current[0]!.startMs
    const endMs = current.at(-1)!.endMs
    chunks.push({
      text: current.map((word) => word.text).join(' '),
      from: Math.max(0, Math.round((startMs / 1000) * fps)),
      durationInFrames: Math.max(12, Math.round(((endMs - startMs) / 1000) * fps)),
      words: current.map((word) => ({
        text: word.text,
        startMs: word.startMs,
        endMs: word.endMs,
      })),
    })
    current = []
    chars = 0
  }

  for (const word of cleaned) {
    const nextChars = chars + (chars > 0 ? 1 : 0) + word.text.length
    const punct = /[.!?]$/.test(word.text)
    if (current.length > 0 && nextChars > MAX_CHARS) flush()
    current.push(word)
    chars += (chars > 0 ? 1 : 0) + word.text.length
    if (punct) flush()
  }
  flush()
  return chunks
}

export const applyCaptionsFromTranscript = (
  project: StudioProject,
  words: TranscriptWord[],
): StudioProject => {
  const chunks = chunkTranscriptCaptions(words, project.fps)
  if (chunks.length === 0) {
    throw new Error('Transcript has no words to caption')
  }
  const captioned = chunks.reduce(
    (next, chunk) =>
      addCaptions(next, {
        ...chunk,
        style: { presetId: 'karaoke' },
      }),
    project,
  )
  return applyCaptionEmphasis(captioned)
}

export const readTranscriptWords = (project: StudioProject, clipId: string): TranscriptWord[] => {
  const clip = project.clips.find((item) => item.id === clipId)
  if (!clip) throw new Error(`Unknown clip: ${clipId}`)
  const asset = project.assets.find((item) => item.id === clip.assetId)
  if (!asset) throw new Error(`Unknown asset: ${clip.assetId}`)
  const raw = asset.probe?.transcriptSegments
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      const record = row as { startMs?: unknown; endMs?: unknown; text?: unknown }
      return {
        startMs: Number(record.startMs) || 0,
        endMs: Number(record.endMs) || 0,
        text: String(record.text ?? ''),
      }
    })
    .filter((row) => row.text.trim().length > 0)
}
