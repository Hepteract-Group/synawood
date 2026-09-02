import { describe, expect, it } from 'vitest'
import { HIGHLIGHT_SCHEMA, highlightScoresFromResult } from './highlight-pack'

describe('highlight pack (#590)', () => {
  it('reads shot scores from Analyze JSON', () => {
    const scores = highlightScoresFromResult({
      moments: [
        {
          shotId: '22222222-2222-4222-8222-222222222222',
          startMs: 8000,
          endMs: 10000,
          score: 9,
          label: 'proof',
        },
      ],
    })
    expect(scores.get('22222222-2222-4222-8222-222222222222')).toBe(9)
    expect(HIGHLIGHT_SCHEMA.required).toEqual(['moments'])
  })

  it('maps a window without shotId onto overlapping shots (#664)', () => {
    const scores = highlightScoresFromResult(
      {
        moments: [{ startMs: 4000, endMs: 6000, score: 0.9, label: 'proof' }],
      },
      [
        { id: 'wide', startMs: 0, endMs: 40_000 },
        { id: 'beat', startMs: 4000, endMs: 6000 },
      ],
    )
    expect(scores.get('beat')).toBe(0.9)
    expect(scores.has('wide')).toBe(false)
  })
})
