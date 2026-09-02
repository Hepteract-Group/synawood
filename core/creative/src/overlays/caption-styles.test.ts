import { describe, expect, it } from 'vitest'
import {
  CAPTION_STYLE_PRESETS,
  activeCaptionWordIndex,
  isCaptionStyleId,
  resolveCaptionPreset,
} from './caption-styles'

describe('caption style presets', () => {
  it('ships band, two-line, word-highlight, and karaoke', () => {
    expect(CAPTION_STYLE_PRESETS.map((preset) => preset.id)).toEqual([
      'band',
      'two-line',
      'word-highlight',
      'karaoke',
    ])
    expect(isCaptionStyleId('band')).toBe(true)
    expect(isCaptionStyleId('karaoke')).toBe(true)
  })

  it('falls karaoke back to band when word timings are missing', () => {
    expect(resolveCaptionPreset('karaoke', [])).toBe('band')
    expect(resolveCaptionPreset('karaoke', [{ text: 'Hi', startMs: 0, endMs: 400 }])).toBe(
      'karaoke',
    )
  })

  it('picks the spoken word at a given time', () => {
    const words = [
      { text: 'Edit', startMs: 0, endMs: 400 },
      { text: 'PDFs', startMs: 400, endMs: 900 },
    ]
    expect(activeCaptionWordIndex(words, 100)).toBe(0)
    expect(activeCaptionWordIndex(words, 500)).toBe(1)
  })
})
