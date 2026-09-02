import { describe, expect, it } from 'vitest'
import {
  formatShotClock,
  hitRangeLabel,
  placeOptionsForHit,
  shotRangeLabel,
  analysisNotesForPreview,
  analysisNotesFromAnalyzeResponse,
  ANALYZE_LOAD_ERROR,
  previewShotToOpen,
  secondsFromStartMs,
} from './story-preview-helpers'

describe('story preview helpers (#172)', () => {
  it('formats shot clocks', () => {
    expect(formatShotClock(0)).toBe('0:00')
    expect(formatShotClock(65_000)).toBe('1:05')
  })

  it('labels shot ranges', () => {
    expect(shotRangeLabel({ startMs: 0, endMs: 4000 })).toBe('0:00–0:04')
    expect(shotRangeLabel({ startMs: 12_000, endMs: null })).toBe('0:12')
  })

  it('omits a duration chip when a Story hit has no shot window', () => {
    expect(hitRangeLabel({})).toBeNull()
    expect(hitRangeLabel({ startMs: 0, endMs: 4000 })).toBe('0:00–0:04')
  })

  it('Place options keep the Shot trim, not the whole file (#592)', () => {
    expect(placeOptionsForHit({ startMs: 8_000, endMs: 10_000 })).toEqual({
      startMs: 8_000,
      endMs: 10_000,
    })
    expect(placeOptionsForHit({})).toBeUndefined()
  })

  it('shows compliance and highlight notes when Analyze rows exist (#592)', () => {
    expect(analysisNotesForPreview([])).toEqual([])
    expect(
      analysisNotesForPreview([
        {
          kind: 'compliance',
          result: {
            hits: [{ timestampMs: 0, kind: 'claim', quote: 'HIPAA compliant', severity: 'high' }],
          },
        },
        {
          kind: 'highlight',
          result: { moments: [{ startMs: 8000, endMs: 10000, score: 9, label: 'proof beat' }] },
        },
      ]),
    ).toEqual([
      { kind: 'compliance', text: 'HIPAA compliant' },
      { kind: 'highlight', text: 'proof beat' },
    ])
  })

  it('failed Analyze is a load error, not empty notes (#844)', () => {
    expect(analysisNotesFromAnalyzeResponse({ ok: false, analyses: [] })).toEqual({
      notes: [],
      loadError: ANALYZE_LOAD_ERROR,
    })
    expect(analysisNotesFromAnalyzeResponse({ ok: true, analyses: [] })).toEqual({
      notes: [],
      loadError: null,
    })
    expect(
      analysisNotesFromAnalyzeResponse({
        ok: true,
        analyses: [
          {
            kind: 'highlight',
            result: { moments: [{ startMs: 0, endMs: 1000, score: 8, label: 'hook' }] },
          },
        ],
      }),
    ).toEqual({
      notes: [{ kind: 'highlight', text: 'hook' }],
      loadError: null,
    })
  })

  const shot = (
    id: string,
    startMs: number,
    endMs: number | null = startMs + 2000,
  ): {
    id: string
    ordinal: number
    startMs: number
    endMs: number | null
    thumbBlobKey: string | null
  } => ({ id, ordinal: 0, startMs, endMs, thumbBlobKey: null })

  it('opens Preview on the search hit shot, not shot 0 (#847)', () => {
    const shots = [shot('s0', 0, 2000), shot('s1', 8000, 10000), shot('s2', 12000, 14000)]
    expect(previewShotToOpen(shots, { shotId: 's1' })?.id).toBe('s1')
    expect(previewShotToOpen(shots, { startMs: 8000 })?.id).toBe('s1')
    expect(previewShotToOpen(shots, { startMs: 8500 })?.id).toBe('s1')
    expect(previewShotToOpen(shots, {})?.id).toBe('s0')
    expect(previewShotToOpen([], { shotId: 's1' })).toBeNull()
    expect(secondsFromStartMs(8000)).toBe(8)
  })
})
