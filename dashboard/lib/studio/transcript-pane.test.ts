import { describe, expect, it } from 'vitest'
import {
  briefTextFromProject,
  CLARITY_EMPTY_COPY,
  CLARITY_EMPTY_NO_BRIEF,
  clarityCutsForTranscript,
  needsClarityConfirm,
  PAUSE_EMPTY_COPY,
  pauseCutsForTranscript,
  pickTranscriptPaneView,
  readAssetTranscriptSegments,
  RETAKE_EMPTY_COPY,
  retakeCutsForTranscript,
} from './transcript-pane'

describe('pickTranscriptPaneView', () => {
  const segments = [
    { startMs: 0, endMs: 400, text: 'Keep' },
    { startMs: 400, endMs: 900, text: 'this' },
  ]

  it('asks to transcribe when the take has no words', () => {
    expect(
      pickTranscriptPaneView({
        collapsed: false,
        clipId: 'c1',
        segments: [],
        trimStartMs: 0,
        durationMs: 4000,
        playheadFrame: 0,
        fps: 30,
        transcribing: false,
      }),
    ).toEqual({ kind: 'transcribe', busy: false })
  })

  it('highlights the word under the playhead', () => {
    const view = pickTranscriptPaneView({
      collapsed: false,
      clipId: 'c1',
      segments,
      trimStartMs: 0,
      durationMs: 4000,
      playheadFrame: 15,
      fps: 30,
      transcribing: false,
    })
    expect(view.kind).toBe('script')
    if (view.kind !== 'script') return
    expect(view.words.map((word) => word.text)).toEqual(['Keep', 'this'])
    expect(view.activeIndex).toBe(1)
  })

  it('stays collapsed until restored', () => {
    expect(
      pickTranscriptPaneView({
        collapsed: true,
        clipId: 'c1',
        segments,
        trimStartMs: 0,
        durationMs: 4000,
        playheadFrame: 0,
        fps: 30,
        transcribing: false,
      }).kind,
    ).toBe('collapsed')
  })
})

describe('needsClarityConfirm', () => {
  it('asks before cutting more than 15% of the take', () => {
    expect(needsClarityConfirm(1600, 10000)).toBe(true)
    expect(needsClarityConfirm(1000, 10000)).toBe(false)
  })
})

describe('pauseCutsForTranscript (#873)', () => {
  it('returns clip-local pause cuts and visitor empty copy', () => {
    expect(PAUSE_EMPTY_COPY).toBe('No long pauses in this take.')
    expect(
      pauseCutsForTranscript({
        segments: [
          { startMs: 0, endMs: 500, text: 'Hello' },
          { startMs: 1500, endMs: 2000, text: 'there' },
        ],
        trimStartMs: 0,
        durationMs: 4000,
      }),
    ).toEqual([{ startMs: 700, endMs: 1500, reason: 'pause' }])
  })

  it('returns nothing when gaps stay under 0.6s', () => {
    expect(
      pauseCutsForTranscript({
        segments: [
          { startMs: 0, endMs: 500, text: 'Hello' },
          { startMs: 900, endMs: 1200, text: 'there' },
        ],
        trimStartMs: 0,
        durationMs: 4000,
      }),
    ).toEqual([])
  })
})

describe('retakeCutsForTranscript (#874)', () => {
  it('returns clip-local false-start cuts and visitor empty copy', () => {
    expect(RETAKE_EMPTY_COPY).toBe('No false starts in this take.')
    expect(
      retakeCutsForTranscript({
        segments: [
          { startMs: 0, endMs: 800, text: 'I think we should' },
          { startMs: 900, endMs: 2500, text: 'I think we should ship Friday' },
        ],
        trimStartMs: 0,
        durationMs: 4000,
      }),
    ).toEqual([{ startMs: 0, endMs: 800, reason: 'retake' }])
  })

  it('returns nothing when the take is not repeated', () => {
    expect(
      retakeCutsForTranscript({
        segments: [
          { startMs: 0, endMs: 800, text: 'Edit PDFs in the browser' },
          { startMs: 900, endMs: 1500, text: 'Ship Friday' },
        ],
        trimStartMs: 0,
        durationMs: 4000,
      }),
    ).toEqual([])
  })
})

describe('clarityCutsForTranscript (#875)', () => {
  it('cuts rambling that misses the brief', () => {
    expect(CLARITY_EMPTY_NO_BRIEF).toBe('Add a brief first so we know what is off-topic.')
    expect(CLARITY_EMPTY_COPY).toBe('No rambling in this take.')
    expect(briefTextFromProject({ product: { oneLiner: 'Edit PDFs in the browser' } })).toBe(
      'Edit PDFs in the browser',
    )
    expect(
      clarityCutsForTranscript({
        segments: [
          { startMs: 0, endMs: 2000, text: 'A long ramble about lunch' },
          { startMs: 2000, endMs: 4000, text: 'Edit PDFs in the browser' },
        ],
        briefText: 'Edit PDFs in the browser',
        trimStartMs: 0,
        durationMs: 4000,
      }),
    ).toEqual([{ startMs: 0, endMs: 2000, reason: 'clarity' }])
  })
})

describe('readAssetTranscriptSegments', () => {
  it('ignores empty probe rows', () => {
    expect(
      readAssetTranscriptSegments({
        transcriptSegments: [
          { startMs: 0, endMs: 200, text: '  ' },
          { startMs: 0, endMs: 200, text: 'Hi' },
        ],
      }),
    ).toEqual([{ startMs: 0, endMs: 200, text: 'Hi' }])
  })
})
