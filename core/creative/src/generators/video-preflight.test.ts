import { describe, expect, it } from 'vitest'
import { VIDEO_MAX_INPUT_IMAGE_BYTES } from '../model-profiles/video-models'
import { preflightVideoGenerate } from './video-preflight'

describe('preflightVideoGenerate (#603)', () => {
  it('allows N stills at the Seedance 2.0 Fast cap', () => {
    expect(
      preflightVideoGenerate({
        modelId: 'bytedance/seedance-2.0-fast',
        stillCount: 9,
      }),
    ).toEqual({ ok: true })
  })

  it('fails over the cap before spend, without dropping extras', () => {
    const result = preflightVideoGenerate({
      modelId: 'bytedance/seedance-2.0-fast',
      stillCount: 12,
    })
    expect(result).toMatchObject({ ok: false, code: 'still_count' })
    if (result.ok) throw new Error('expected fail')
    expect(result.message).toMatch(/takes 9 stills; you passed 12/)
    expect(result.message).toMatch(/no credits used/)
    expect(result.message).not.toMatch(/using the first 9/i)
  })

  it('fails Veo when more than one still is passed', () => {
    const result = preflightVideoGenerate({
      modelId: 'google/veo-3.1-fast-generate-001',
      stillCount: 2,
    })
    expect(result).toMatchObject({ ok: false, code: 'still_count' })
    if (result.ok) throw new Error('expected fail')
    expect(result.message).toMatch(/takes 1 still; you passed 2/)
    expect(result.message).toMatch(/Seedance 2\.0 Fast: 9/)
  })

  it('fails an oversized still before Gateway', () => {
    const result = preflightVideoGenerate({
      modelId: 'bytedance/seedance-2.5',
      stillCount: 1,
      stillByteLengths: [VIDEO_MAX_INPUT_IMAGE_BYTES + 1],
    })
    expect(result).toMatchObject({ ok: false, code: 'still_size' })
    if (result.ok) throw new Error('expected fail')
    expect(result.message).toMatch(/30MB/)
    expect(result.message).toMatch(/no credits used/)
  })

  it('allows a still plus a video ref on Seedance 2.0 Fast (#610)', () => {
    expect(
      preflightVideoGenerate({
        modelId: 'bytedance/seedance-2.0-fast',
        stillCount: 1,
        videoCount: 1,
      }),
    ).toEqual({ ok: true })
  })

  it('fails Veo when a video clip is tagged (#610)', () => {
    const result = preflightVideoGenerate({
      modelId: 'google/veo-3.1-fast-generate-001',
      stillCount: 1,
      videoCount: 1,
    })
    expect(result).toMatchObject({ ok: false, code: 'video_count' })
    if (result.ok) throw new Error('expected fail')
    expect(result.message).toMatch(/stills only/)
    expect(result.message).toMatch(/no credits used/)
  })

  it('fails when a tagged file is neither still nor video (#610)', () => {
    const result = preflightVideoGenerate({
      modelId: 'bytedance/seedance-2.0-fast',
      stillCount: 1,
      otherCount: 1,
    })
    expect(result).toMatchObject({ ok: false, code: 'unsupported_ref' })
    if (result.ok) throw new Error('expected fail')
    expect(result.message).toMatch(/not a still or a video/)
    expect(result.message).toMatch(/no credits used/)
  })

  it('fails a tagged audio file before spend (#608)', () => {
    const result = preflightVideoGenerate({
      modelId: 'bytedance/seedance-2.0-fast',
      stillCount: 1,
      audioCount: 1,
    })
    expect(result).toMatchObject({ ok: false, code: 'audio_ref' })
    if (result.ok) throw new Error('expected fail')
    expect(result.message).toMatch(/does not take audio/)
    expect(result.message).toMatch(/no credits used/)
  })

  it('fails first/last still aspect mismatch before spend (#608)', () => {
    const result = preflightVideoGenerate({
      modelId: 'bytedance/seedance-2.0-fast',
      stillCount: 2,
      firstStillSize: { width: 1080, height: 1920 },
      lastStillSize: { width: 1920, height: 1080 },
    })
    expect(result).toMatchObject({ ok: false, code: 'last_frame_ratio' })
    if (result.ok) throw new Error('expected fail')
    expect(result.message).toMatch(/aspect ratios/)
    expect(result.message).toMatch(/no credits used/)
  })

  it('allows matching portrait stills as first and last frame (#608)', () => {
    expect(
      preflightVideoGenerate({
        modelId: 'bytedance/seedance-2.0-fast',
        stillCount: 2,
        firstStillSize: { width: 1080, height: 1920 },
        lastStillSize: { width: 720, height: 1280 },
      }),
    ).toEqual({ ok: true })
  })

  it('does not size-check stub models', () => {
    expect(
      preflightVideoGenerate({
        modelId: 'mock-video',
        stillCount: 2,
        stillByteLengths: [VIDEO_MAX_INPUT_IMAGE_BYTES + 1],
      }),
    ).toEqual({ ok: true })
  })
})
