import { describe, expect, it, vi } from 'vitest'
import {
  excerptTranscript,
  MAX_TRANSCRIPT_EXCERPT,
  shotWindowContainsPhrase,
  transcribeAssetForIndex,
  transcriptWindowForShot,
} from './transcript'

describe('excerptTranscript', () => {
  it('collapses whitespace and truncates long text', () => {
    expect(excerptTranscript('  hello   world  ')).toBe('hello world')
    const long = 'word '.repeat(1_000)
    const out = excerptTranscript(long)
    expect(out.length).toBeLessThanOrEqual(MAX_TRANSCRIPT_EXCERPT)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('transcribeAssetForIndex', () => {
  it('skips image assets', async () => {
    const result = await transcribeAssetForIndex({
      assetId: '11111111-1111-4111-8111-111111111111',
      modelId: 'openai/whisper-1',
      kind: 'image',
      mediaType: 'image/jpeg',
      fileName: 'still.jpg',
      bytes: Buffer.from('jpeg'),
    })
    expect(result).toMatchObject({ skipped: true, reason: expect.stringMatching(/image/i) })
  })

  it('stores an excerpt from stub/mock STT for video', async () => {
    const transcribeMedia = vi.fn(async () => ({
      text: 'Edit PDFs without Adobe on the go',
      segments: [{ startMs: 0, endMs: 2000, text: 'Edit PDFs without Adobe on the go' }],
    }))
    const result = await transcribeAssetForIndex(
      {
        assetId: '11111111-1111-4111-8111-111111111111',
        modelId: 'mock-transcribe',
        kind: 'video',
        mediaType: 'video/mp4',
        fileName: 'clip.mp4',
        bytes: Buffer.from('mp4'),
      },
      { transcribeMedia: transcribeMedia as never },
    )
    expect(result).toEqual({
      skipped: false,
      transcriptExcerpt: 'Edit PDFs without Adobe on the go',
      segments: [{ startMs: 0, endMs: 2000, text: 'Edit PDFs without Adobe on the go' }],
    })
    expect(transcribeMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'mock-transcribe',
        audioAssetId: '11111111-1111-4111-8111-111111111111',
      }),
    )
  })
})

describe('transcriptWindowForShot (#515)', () => {
  const segments = [
    { startMs: 0, endMs: 8_000, text: 'welcome to the product walkthrough' },
    { startMs: 8_000, endMs: 12_000, text: 'our pricing starts at nine pounds' },
  ]

  it('returns the overlapping speech for a shot, not the whole take', () => {
    expect(transcriptWindowForShot({ startMs: 8_000, endMs: 12_000 }, segments)).toBe(
      'our pricing starts at nine pounds',
    )
    expect(transcriptWindowForShot({ startMs: 0, endMs: 8_000 }, segments)).toBe(
      'welcome to the product walkthrough',
    )
  })

  it('matches a phrase only inside the window that contains it', () => {
    const priceWindow = transcriptWindowForShot({ startMs: 8_000, endMs: 12_000 }, segments)
    const introWindow = transcriptWindowForShot({ startMs: 0, endMs: 8_000 }, segments)
    expect(shotWindowContainsPhrase(priceWindow, 'pricing')).toBe(true)
    expect(shotWindowContainsPhrase(introWindow, 'pricing')).toBe(false)
  })

  it('returns null when there are no timestamps', () => {
    expect(transcriptWindowForShot({ startMs: 0, endMs: 8_000 }, [])).toBeNull()
  })
})
