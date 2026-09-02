import { complianceHitsFromResult } from '@synawood/creative/asset-intelligence/compliance-hits'
import { highlightMomentsFromResult } from '@synawood/creative/asset-intelligence/highlight-moments'

export type PlaceAssetOptions = {
  startMs?: number
  endMs?: number | null
}

/** Story Place sends the Shot window so the route trims, not the whole take (#592). */
export const placeOptionsForHit = (hit: {
  startMs?: number
  endMs?: number | null
}): PlaceAssetOptions | undefined =>
  typeof hit.startMs === 'number' ? { startMs: hit.startMs, endMs: hit.endMs ?? null } : undefined

export type StoryPreviewShot = {
  id: string
  ordinal: number
  startMs: number
  endMs: number | null
  thumbBlobKey: string | null
}

export type StoryPreviewDescription = {
  assetId: string
  productId: string
  status: string
  stage: string
  caption: string | null
  transcriptExcerpt: string | null
  lastError: string | null
  tags: string[]
  shots: StoryPreviewShot[]
}

export const formatShotClock = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '0:00'
  const whole = Math.floor(ms / 1000)
  const m = Math.floor(whole / 60)
  const s = whole % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export const shotRangeLabel = (shot: Pick<StoryPreviewShot, 'startMs' | 'endMs'>): string => {
  const start = formatShotClock(shot.startMs)
  if (shot.endMs == null) return start
  return `${start}–${formatShotClock(shot.endMs)}`
}

/** Duration chip on a Story search hit; null when the hit is a whole asset. */
export const hitRangeLabel = (hit: { startMs?: number; endMs?: number | null }): string | null => {
  if (typeof hit.startMs !== 'number') return null
  return shotRangeLabel({ startMs: hit.startMs, endMs: hit.endMs ?? null })
}

export const assetShotThumbUrl = (projectId: string, assetId: string, shotId: string): string =>
  `/api/studio/projects/${projectId}/assets/${assetId}/content?variant=shot&shotId=${encodeURIComponent(shotId)}`

export type StoryAnalysisNote = {
  kind: string
  text: string
}

type AnalysisRow = {
  kind: string
  result: Record<string, unknown>
}

/** Preview modal copy for stored Analyze rows. Empty list means hide the section. */
export const analysisNotesForPreview = (rows: readonly AnalysisRow[]): StoryAnalysisNote[] => {
  const notes: StoryAnalysisNote[] = []
  for (const row of rows) {
    if (row.kind === 'compliance') {
      for (const hit of complianceHitsFromResult(row.result)) {
        const text = hit.quote.trim() || hit.visualNote.trim()
        if (text) notes.push({ kind: 'compliance', text })
      }
    }
    if (row.kind === 'highlight') {
      for (const moment of highlightMomentsFromResult(row.result)) {
        if (moment.label) notes.push({ kind: 'highlight', text: moment.label })
      }
    }
  }
  return notes
}

export const ANALYZE_LOAD_ERROR = "Couldn't load notes for this file."

export const analysisNotesFromAnalyzeResponse = (input: {
  ok: boolean
  analyses?: readonly AnalysisRow[]
}): { notes: StoryAnalysisNote[]; loadError: string | null } => {
  if (!input.ok) {
    return { notes: [], loadError: ANALYZE_LOAD_ERROR }
  }
  return { notes: analysisNotesForPreview(input.analyses ?? []), loadError: null }
}

export const secondsFromStartMs = (startMs: number): number => startMs / 1000

/** Shot to open when Preview is launched from a Story search hit (#847). */
export const previewShotToOpen = (
  shots: readonly StoryPreviewShot[],
  hit: { shotId?: string; startMs?: number },
): StoryPreviewShot | null => {
  if (hit.shotId) {
    const byId = shots.find((shot) => shot.id === hit.shotId)
    if (byId) return byId
  }
  if (typeof hit.startMs === 'number') {
    const covering = shots.find((shot) => {
      if (shot.startMs > hit.startMs!) return false
      return shot.endMs == null || hit.startMs! < shot.endMs
    })
    if (covering) return covering
  }
  return shots[0] ?? null
}
