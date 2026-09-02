/** Wave 2J / #590 + #664 — Analyze `highlight` pack + rank boost (ADR-0053). */

import type { JsonSchemaObject } from './analyze-schema'

export { highlightMomentsFromResult } from './highlight-moments'
export type { HighlightMoment } from './highlight-moments'

export const HIGHLIGHT_SCHEMA: JsonSchemaObject = {
  type: 'object',
  properties: {
    moments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shotId: { type: 'string' },
          startMs: { type: 'number' },
          endMs: { type: 'number' },
          score: { type: 'number' },
          label: { type: 'string' },
        },
        required: ['startMs', 'endMs', 'score', 'label'],
      },
    },
  },
  required: ['moments'],
}

export type HighlightShotRef = {
  id: string
  startMs: number
  endMs: number | null
}

const windowsOverlap = (startMs: number, endMs: number | null, shot: HighlightShotRef): boolean => {
  const winEnd = endMs ?? Number.POSITIVE_INFINITY
  const shotEnd = shot.endMs ?? Number.POSITIVE_INFINITY
  return startMs < shotEnd && winEnd > shot.startMs
}

export const highlightScoresFromResult = (
  result: Record<string, unknown>,
  shots?: readonly HighlightShotRef[],
): Map<string, number> => {
  const scores = new Map<string, number>()
  const raw = result.moments
  if (!Array.isArray(raw)) return scores
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const shotId = String((row as { shotId?: unknown }).shotId ?? '').trim()
    const score = Number((row as { score?: unknown }).score)
    if (!Number.isFinite(score)) continue
    if (shotId) {
      scores.set(shotId, score)
      continue
    }
    const startMs = Number((row as { startMs?: unknown }).startMs)
    const endMsRaw = (row as { endMs?: unknown }).endMs
    const endMs = endMsRaw == null ? null : Number(endMsRaw)
    if (!Number.isFinite(startMs) || (endMs != null && !Number.isFinite(endMs))) continue
    const overlapping = (shots ?? []).filter((shot) => windowsOverlap(startMs, endMs, shot))
    if (overlapping.length === 0) continue
    overlapping.sort((left, right) => {
      const leftDur = (left.endMs ?? left.startMs) - left.startMs
      const rightDur = (right.endMs ?? right.startMs) - right.startMs
      return leftDur - rightDur
    })
    const shot = overlapping[0]!
    const prev = scores.get(shot.id)
    if (prev == null || score > prev) scores.set(shot.id, score)
  }
  return scores
}
