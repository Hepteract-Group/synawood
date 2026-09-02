import { describe, expect, it } from 'vitest'
import {
  deleteCutsForWordRange,
  expandTranscriptWords,
  playheadMsFromFrame,
  splitFrameForWord,
  trimCutsForWordRange,
  wordIndexAtMs,
  wordsOnClip,
} from './transcript-edit'

describe('expandTranscriptWords', () => {
  it('splits a phrase into words and spreads the times', () => {
    const words = expandTranscriptWords([{ startMs: 0, endMs: 900, text: 'edit PDFs faster' }])
    expect(words.map((word) => word.text)).toEqual(['edit', 'PDFs', 'faster'])
    expect(words[0]?.startMs).toBe(0)
    expect(words[2]?.endMs).toBe(900)
    expect(words[1]!.startMs).toBeGreaterThan(words[0]!.startMs)
  })

  it('keeps a single-token segment as one word', () => {
    expect(expandTranscriptWords([{ startMs: 0, endMs: 400, text: 'Hello' }])[0]?.text).toBe(
      'Hello',
    )
  })
})

describe('word selection cuts', () => {
  const words = expandTranscriptWords([
    { startMs: 0, endMs: 400, text: 'Keep' },
    { startMs: 400, endMs: 800, text: 'this' },
    { startMs: 800, endMs: 1400, text: 'ramble' },
    { startMs: 1400, endMs: 1800, text: 'out' },
  ])

  it('deletes the selected span as one clarity cut', () => {
    expect(deleteCutsForWordRange({ words, fromIndex: 2, toIndex: 3 })).toEqual([
      { startMs: 800, endMs: 1800, reason: 'clarity' },
    ])
  })

  it('trim keeps the selection and drops the tails', () => {
    expect(trimCutsForWordRange({ words, fromIndex: 1, toIndex: 2 })).toEqual([
      { startMs: 0, endMs: 400, reason: 'clarity' },
      { startMs: 1400, endMs: 1800, reason: 'clarity' },
    ])
  })

  it('split lands on the clip timeline, not the asset clock', () => {
    const word = words[2]!
    expect(splitFrameForWord({ word, fps: 30, clipFrom: 90, trimStartMs: 0 })).toBe(
      90 + Math.round((800 / 1000) * 30),
    )
  })

  it('highlights the word under the playhead', () => {
    expect(wordIndexAtMs(words, 850)).toBe(2)
    expect(playheadMsFromFrame(30, 30)).toBe(1000)
  })

  it('drops words outside the trimmed clip window', () => {
    const visible = wordsOnClip(words, { trimStartMs: 400, durationMs: 1000 })
    expect(visible.map((word) => word.text)).toEqual(['this', 'ramble'])
  })
})
