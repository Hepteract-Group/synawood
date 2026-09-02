import { describe, expect, it, vi } from 'vitest'
import {
  extractShotThumbBytes,
  shotNeedsKeyframeThumb,
  shotThumbSeekSeconds,
} from './extract-shot-thumb'

describe('shot keyframe thumbs (#580)', () => {
  it('seeks the mid-window second for a video shot', () => {
    expect(shotThumbSeekSeconds(0, 4_000)).toBe(2)
    expect(shotThumbSeekSeconds(4_000, 8_000)).toBe(6)
  })

  it('needs a keyframe for video and image, not audio', () => {
    expect(shotNeedsKeyframeThumb('video')).toBe(true)
    expect(shotNeedsKeyframeThumb('image')).toBe(true)
    expect(shotNeedsKeyframeThumb('audio')).toBe(false)
    expect(shotNeedsKeyframeThumb('other')).toBe(false)
  })

  it('uses the still bytes as the thumb for images', async () => {
    const still = Buffer.from('fake-jpeg-still')
    const result = await extractShotThumbBytes({
      kind: 'image',
      bytes: still,
      contentType: 'image/jpeg',
      fileName: 'look.jpg',
      startMs: 0,
      endMs: null,
    })
    expect(result).toEqual({
      skipped: false,
      bytes: still,
      contentType: 'image/jpeg',
    })
  })

  it('extracts a mid-window JPEG for video via the frame helper', async () => {
    const jpeg = Buffer.from('shot-jpeg')
    const extractFrame = vi.fn(async () => jpeg)
    const result = await extractShotThumbBytes({
      kind: 'video',
      bytes: Buffer.from('mp4-bytes-here!!!!'),
      contentType: 'video/mp4',
      fileName: 'clip.mp4',
      startMs: 0,
      endMs: 8_000,
      extractFrame,
    })
    expect(extractFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        seekSeconds: 4,
        contentType: 'video/mp4',
        fileName: 'clip.mp4',
      }),
    )
    expect(result).toEqual({
      skipped: false,
      bytes: jpeg,
      contentType: 'image/jpeg',
    })
  })

  it('skips audio with a reason instead of calling ffmpeg', async () => {
    const extractFrame = vi.fn()
    const result = await extractShotThumbBytes({
      kind: 'audio',
      bytes: Buffer.from('wav'),
      contentType: 'audio/wav',
      fileName: 'vo.wav',
      startMs: 0,
      endMs: 3_000,
      extractFrame,
    })
    expect(extractFrame).not.toHaveBeenCalled()
    expect(result.skipped).toBe(true)
  })
})
