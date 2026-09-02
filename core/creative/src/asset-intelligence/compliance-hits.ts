/** Client-safe compliance hit parse (no Node). Used by Analyze pack + Story notes (#846). */

export type ComplianceHit = {
  timestampMs: number
  kind: string
  quote: string
  visualNote: string
  severity: string
}

export const complianceHitsFromResult = (result: Record<string, unknown>): ComplianceHit[] => {
  const raw = result.hits
  if (!Array.isArray(raw)) return []
  const hits: ComplianceHit[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const timestampMs = Number((row as { timestampMs?: unknown }).timestampMs)
    const kind = String((row as { kind?: unknown }).kind ?? '').trim()
    const quote = String((row as { quote?: unknown }).quote ?? '').trim()
    const visualNote = String((row as { visualNote?: unknown }).visualNote ?? '').trim()
    const severity = String((row as { severity?: unknown }).severity ?? '').trim()
    if (!Number.isFinite(timestampMs) || !kind || !severity) continue
    const visualNoteOnly = /^(logo|overlay)$/i.test(kind)
    if (visualNoteOnly) {
      if (!visualNote && !quote) continue
    } else if (!quote) {
      continue
    }
    hits.push({
      timestampMs: Math.max(0, Math.round(timestampMs)),
      kind,
      quote,
      visualNote,
      severity,
    })
  }
  return hits
}
