/** Wave 2C / #164 — heuristic shot segmentation (no VLM). */

export type ProposedShot = {
  ordinal: number
  startMs: number
  endMs: number | null
}

/** Soft cap so Story Builder doesn’t drown in slices. */
export const MAX_HEURISTIC_SHOTS = 24
/** Target window length for long videos. */
export const HEURISTIC_SHOT_MS = 4_000

/**
 * Images / unknown → one shot.
 * Video / audio with duration → fixed windows (~4s), capped at MAX_HEURISTIC_SHOTS.
 */
export const proposeHeuristicShots = (input: {
  kind: 'video' | 'image' | 'audio' | 'other'
  durationSeconds: number | null
}): ProposedShot[] => {
  if (input.kind === 'image' || input.kind === 'other') {
    return [{ ordinal: 0, startMs: 0, endMs: null }]
  }

  const seconds = input.durationSeconds
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return [{ ordinal: 0, startMs: 0, endMs: null }]
  }

  const totalMs = Math.max(1, Math.round(seconds * 1000))
  if (totalMs <= HEURISTIC_SHOT_MS) {
    return [{ ordinal: 0, startMs: 0, endMs: totalMs }]
  }

  const rawCount = Math.ceil(totalMs / HEURISTIC_SHOT_MS)
  const count = Math.min(MAX_HEURISTIC_SHOTS, rawCount)
  const windowMs = Math.ceil(totalMs / count)
  const shots: ProposedShot[] = []
  for (let i = 0; i < count; i += 1) {
    const startMs = i * windowMs
    const endMs = i === count - 1 ? totalMs : Math.min(totalMs, (i + 1) * windowMs)
    shots.push({ ordinal: i, startMs, endMs })
  }
  return shots
}
