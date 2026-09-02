/** Client-safe highlight moment parse (no Node). Used by Analyze pack + Story notes (#846). */

export type HighlightMoment = {
  shotId: string
  startMs: number | null
  endMs: number | null
  score: number
  label: string
}

export const highlightMomentsFromResult = (result: Record<string, unknown>): HighlightMoment[] => {
  const raw = result.moments
  if (!Array.isArray(raw)) return []
  const moments: HighlightMoment[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const score = Number((row as { score?: unknown }).score)
    if (!Number.isFinite(score)) continue
    const startRaw = (row as { startMs?: unknown }).startMs
    const endRaw = (row as { endMs?: unknown }).endMs
    const startMs = startRaw == null ? null : Number(startRaw)
    const endMs = endRaw == null ? null : Number(endRaw)
    moments.push({
      shotId: String((row as { shotId?: unknown }).shotId ?? '').trim(),
      startMs: startMs != null && Number.isFinite(startMs) ? startMs : null,
      endMs: endMs != null && Number.isFinite(endMs) ? endMs : null,
      score,
      label: String((row as { label?: unknown }).label ?? '').trim(),
    })
  }
  return moments
}
