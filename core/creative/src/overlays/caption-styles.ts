export const CAPTION_STYLE_IDS = ['band', 'two-line', 'word-highlight', 'karaoke'] as const
export type CaptionStyleId = (typeof CAPTION_STYLE_IDS)[number]

export type CaptionStylePreset = {
  id: CaptionStyleId
  label: string
}

export const CAPTION_STYLE_PRESETS: readonly CaptionStylePreset[] = [
  { id: 'band', label: 'Band' },
  { id: 'two-line', label: 'Two-line' },
  { id: 'word-highlight', label: 'Word highlight' },
  { id: 'karaoke', label: 'Karaoke' },
]

export type CaptionWordTiming = {
  text: string
  startMs: number
  endMs: number
}

export const isCaptionStyleId = (id: string | undefined): id is CaptionStyleId =>
  Boolean(id && (CAPTION_STYLE_IDS as readonly string[]).includes(id))

/** Karaoke needs word timings; otherwise fall back to the static band. */
export const resolveCaptionPreset = (
  requested: string | undefined,
  words: readonly CaptionWordTiming[] | undefined,
): CaptionStyleId => {
  const id = isCaptionStyleId(requested) ? requested : 'band'
  if (id === 'karaoke' && (!words || words.length === 0)) return 'band'
  return id
}

export const activeCaptionWordIndex = (
  words: readonly CaptionWordTiming[],
  timeMs: number,
): number => {
  if (words.length === 0) return -1
  const hit = words.findIndex((word) => timeMs >= word.startMs && timeMs < word.endMs)
  if (hit >= 0) return hit
  for (let index = words.length - 1; index >= 0; index -= 1) {
    if (timeMs >= words[index]!.startMs) return index
  }
  return 0
}
