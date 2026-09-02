import { describe, expect, it } from 'vitest'
import { HEURISTIC_SHOT_MS, MAX_HEURISTIC_SHOTS, proposeHeuristicShots } from './shots'

describe('proposeHeuristicShots (#164)', () => {
  it('returns a single open-ended shot for images', () => {
    expect(proposeHeuristicShots({ kind: 'image', durationSeconds: null })).toEqual([
      { ordinal: 0, startMs: 0, endMs: null },
    ])
  })

  it('returns one shot when duration fits a single window', () => {
    expect(
      proposeHeuristicShots({ kind: 'video', durationSeconds: HEURISTIC_SHOT_MS / 1000 }),
    ).toEqual([{ ordinal: 0, startMs: 0, endMs: HEURISTIC_SHOT_MS }])
  })

  it('splits long video into capped windows', () => {
    const shots = proposeHeuristicShots({ kind: 'video', durationSeconds: 120 })
    expect(shots.length).toBeGreaterThan(1)
    expect(shots.length).toBeLessThanOrEqual(MAX_HEURISTIC_SHOTS)
    expect(shots[0]?.startMs).toBe(0)
    expect(shots.at(-1)?.endMs).toBe(120_000)
    for (let i = 1; i < shots.length; i += 1) {
      expect(shots[i]!.startMs).toBe(shots[i - 1]!.endMs)
    }
  })
})
