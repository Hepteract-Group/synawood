import { describe, expect, it, vi } from 'vitest'
import { KEYFRAME_THUMBS_MISSING_PREFIX } from './thumbs-missing'
import { writeShotThumbs } from './write-shot-thumbs'

const jpeg = Buffer.from('jpeg-bytes')

describe('writeShotThumbs (#580)', () => {
  it('puts a Blob copy per shot and returns keys by ordinal', async () => {
    const putBlob = vi.fn(async (input: { parts: string[] }) => ({
      blobKey: `local/index/${input.parts.join('/')}`,
    }))
    const extractShotThumb = vi.fn(async () => ({
      skipped: false as const,
      bytes: jpeg,
      contentType: 'image/jpeg',
    }))

    const result = await writeShotThumbs({
      blobEnv: {} as never,
      productId: 'demo',
      assetId: 'asset-1',
      kind: 'video',
      bytes: Buffer.from('mp4'),
      contentType: 'video/mp4',
      fileName: 'clip.mp4',
      shots: [
        { ordinal: 0, startMs: 0, endMs: 4_000 },
        { ordinal: 1, startMs: 4_000, endMs: 8_000 },
      ],
      putBlob: putBlob as never,
      extractShotThumb,
    })

    expect(result.thumbBlobKeyByOrdinal).toEqual({
      0: 'local/index/asset-1/shot-0-thumb.jpg',
      1: 'local/index/asset-1/shot-1-thumb.jpg',
    })
    expect(result.thumbNote).toBeNull()
    expect(putBlob).toHaveBeenCalledTimes(2)
  })

  it('copies the still bytes as the image thumb', async () => {
    const still = Buffer.from('still-png')
    const putBlob = vi.fn(
      async (input: { parts: string[]; data: Buffer; contentType?: string }) => ({
        blobKey: `local/index/${input.parts.join('/')}`,
      }),
    )

    const result = await writeShotThumbs({
      blobEnv: {} as never,
      productId: 'demo',
      assetId: 'asset-still',
      kind: 'image',
      bytes: still,
      contentType: 'image/png',
      fileName: 'look.png',
      shots: [{ ordinal: 0, startMs: 0, endMs: null }],
      putBlob: putBlob as never,
    })

    expect(result.thumbNote).toBeNull()
    expect(result.thumbBlobKeyByOrdinal).toEqual({
      0: 'local/index/asset-still/shot-0-thumb.png',
    })
    expect(putBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'image/png',
        data: still,
      }),
    )
  })

  it('keeps shot keys missing and sets a chip note when extract fails', async () => {
    const putBlob = vi.fn()
    const result = await writeShotThumbs({
      blobEnv: {} as never,
      productId: 'demo',
      assetId: 'asset-1',
      kind: 'video',
      bytes: Buffer.from('mp4'),
      contentType: 'video/mp4',
      fileName: 'clip.mp4',
      shots: [{ ordinal: 0, startMs: 0, endMs: 4_000 }],
      putBlob: putBlob as never,
      extractShotThumb: async () => {
        throw new Error('ffmpeg missing')
      },
    })

    expect(result.thumbBlobKeyByOrdinal).toEqual({})
    expect(result.thumbNote).toMatch(KEYFRAME_THUMBS_MISSING_PREFIX)
    expect(result.thumbNote).toMatch(/ffmpeg missing/)
    expect(putBlob).not.toHaveBeenCalled()
  })

  it('does not flag audio when there is no video frame', async () => {
    const result = await writeShotThumbs({
      blobEnv: {} as never,
      productId: 'demo',
      assetId: 'asset-1',
      kind: 'audio',
      bytes: Buffer.from('wav'),
      contentType: 'audio/wav',
      fileName: 'vo.wav',
      shots: [{ ordinal: 0, startMs: 0, endMs: 3_000 }],
      putBlob: vi.fn() as never,
      extractShotThumb: vi.fn(),
    })
    expect(result.thumbBlobKeyByOrdinal).toEqual({})
    expect(result.thumbNote).toBeNull()
  })
})
