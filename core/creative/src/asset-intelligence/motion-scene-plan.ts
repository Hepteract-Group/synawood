/** #1200 — map analyze_asset rows onto motion Sequences (ADR-0053). Client-safe. */

import { complianceHitsFromResult } from './compliance-hits'
import { highlightMomentsFromResult } from './highlight-moments'
import type { ListedAnalysis } from './analyze-persist'

export type MotionSceneKind = 'device-hero' | 'plate' | 'type-only'

export type MotionScenePlan = {
  kind: MotionSceneKind
  shotId?: string
  startMs?: number
  endMs?: number
  plateAssetId?: string
  note: string
}

export type AnalysisForMotionPlan = Pick<ListedAnalysis, 'kind' | 'result' | 'assetId'> &
  Partial<Pick<ListedAnalysis, 'shotId' | 'startMs' | 'endMs'>>

type Candidate = {
  kind: Exclude<MotionSceneKind, 'type-only'>
  shotId?: string
  startMs?: number
  endMs?: number
  plateAssetId: string
  note: string
  score: number
}

const seededIndex = (seed: string, length: number): number => {
  if (length <= 0) return 0
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % length
}

const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  aStart < bEnd && aEnd > bStart

const optionalRange = (startMs?: number, endMs?: number): { start: number; end: number } | null => {
  if (startMs == null || endMs == null || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null
  }
  if (endMs <= startMs) return null
  return { start: startMs, end: endMs }
}

const timestampInScene = (scene: Candidate, timestampMs: number): boolean => {
  const range = optionalRange(scene.startMs, scene.endMs)
  if (!range) return true
  return timestampMs >= range.start && timestampMs < range.end
}

const isFullBleedUnsafeHit = (hit: {
  kind: string
  quote: string
  visualNote: string
}): boolean => {
  const blob = `${hit.kind} ${hit.quote} ${hit.visualNote}`.toLowerCase()
  if (hit.kind === 'logo' || hit.kind === 'overlay') return true
  return /unsafe|logo-on-logo|logo on logo/.test(blob)
}

const segmentsFromResult = (
  result: Record<string, unknown>,
): Array<{ startMs: number; endMs: number; label: string }> => {
  const raw = result.shots
  if (!Array.isArray(raw)) return []
  const shots: Array<{ startMs: number; endMs: number; label: string }> = []
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const startMs = Number((row as { startMs?: unknown }).startMs)
    const endMs = Number((row as { endMs?: unknown }).endMs)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    shots.push({
      startMs: Math.max(0, Math.round(startMs)),
      endMs: Math.max(0, Math.round(endMs)),
      label: String((row as { label?: unknown }).label ?? '').trim(),
    })
  }
  return shots
}

const toPlan = (row: Candidate, fullBleedUnsafe: boolean): MotionScenePlan => {
  const note = fullBleedUnsafe
    ? `${row.note} — do not full-bleed (unsafe / logo-on-logo)`
    : row.note
  // DeviceFrame is framed, not full-bleed-type. Flagged heroes keep device-hero; plates drop to type-only.
  const kind: MotionSceneKind =
    fullBleedUnsafe && row.kind !== 'device-hero' ? 'type-only' : row.kind
  return {
    kind,
    ...(row.shotId ? { shotId: row.shotId } : {}),
    ...(row.startMs != null ? { startMs: row.startMs } : {}),
    ...(row.endMs != null ? { endMs: row.endMs } : {}),
    plateAssetId: row.plateAssetId,
    note,
  }
}

/**
 * Highlight Moments become a seed-stable device-hero plus plates.
 * Leftover segments fill remaining beats. Empty analysis → no plan (type-led ads are OK).
 */
export const motionScenePlanFromAnalyses = (input: {
  analyses: readonly AnalysisForMotionPlan[]
  motionSeed: string
}): MotionScenePlan[] => {
  const highlights: Candidate[] = []
  const segments: Candidate[] = []
  const complianceByAsset = new Map<string, ReturnType<typeof complianceHitsFromResult>>()

  for (const analysis of input.analyses) {
    if (analysis.kind === 'compliance') {
      complianceByAsset.set(analysis.assetId, complianceHitsFromResult(analysis.result))
      continue
    }
    if (analysis.kind === 'highlight') {
      for (const moment of highlightMomentsFromResult(analysis.result)) {
        const startMs = moment.startMs ?? undefined
        const endMs = moment.endMs ?? undefined
        if (!moment.shotId && optionalRange(startMs, endMs) == null) continue
        highlights.push({
          kind: 'plate',
          ...(moment.shotId ? { shotId: moment.shotId } : {}),
          ...(startMs != null ? { startMs } : {}),
          ...(endMs != null ? { endMs } : {}),
          plateAssetId: analysis.assetId,
          note: moment.label || 'highlight',
          score: moment.score,
        })
      }
      continue
    }
    if (analysis.kind === 'segment') {
      for (const shot of segmentsFromResult(analysis.result)) {
        segments.push({
          kind: 'plate',
          startMs: shot.startMs,
          endMs: shot.endMs,
          plateAssetId: analysis.assetId,
          note: shot.label || 'segment',
          score: 0,
        })
      }
    }
  }

  highlights.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return (left.startMs ?? 0) - (right.startMs ?? 0)
  })

  const ordered: Candidate[] = []
  if (highlights.length > 0) {
    const heroIdx = seededIndex(input.motionSeed, highlights.length)
    const hero = highlights[heroIdx]!
    ordered.push({ ...hero, kind: 'device-hero' })
    for (const [index, row] of highlights.entries()) {
      if (index === heroIdx) continue
      ordered.push(row)
    }
  }

  for (const segment of segments) {
    const range = optionalRange(segment.startMs, segment.endMs)
    if (!range) continue
    const overlapsHighlight = highlights.some((row) => {
      const other = optionalRange(row.startMs, row.endMs)
      if (!other) return false
      return rangesOverlap(range.start, range.end, other.start, other.end)
    })
    if (overlapsHighlight) continue
    ordered.push(segment)
  }

  return ordered.map((row) => {
    const hits = complianceByAsset.get(row.plateAssetId) ?? []
    const fullBleedUnsafe = hits.some(
      (hit) => isFullBleedUnsafeHit(hit) && timestampInScene(row, hit.timestampMs),
    )
    return toPlan(row, fullBleedUnsafe)
  })
}

/** Prompt block so the agent writes Sequences from the plan. Empty → omit. */
export const motionScenePlanContextBlock = (plan: readonly MotionScenePlan[]): string => {
  if (plan.length === 0) return ''
  const lines = plan.map((row) => {
    const shot = row.shotId ? ` shotId=${row.shotId}` : ''
    const window = row.startMs != null && row.endMs != null ? ` ${row.startMs}–${row.endMs}ms` : ''
    const plate = row.plateAssetId ? ` plateAssetId=${row.plateAssetId}` : ''
    return `- kind=${row.kind}${shot}${window}${plate} note=${JSON.stringify(row.note)}`
  })
  return [
    '## Motion scene plan',
    'Write Sequences from this plan. The device-hero row is the DeviceFrame beat. Other rows are plates (Img / still) or KineticType-only. Notes that say do not full-bleed must not use full-bleed-type on that still. Empty analysis is omitted — type-led ads are OK. Still call inspect_preview; analyze_asset never stamps cut review.',
    ...lines,
  ].join('\n')
}
