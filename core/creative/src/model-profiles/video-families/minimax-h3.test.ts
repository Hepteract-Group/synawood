import { describe, expect, it } from 'vitest'
import { GATEWAY_REASONER_MODEL_IDS } from '../reasoner-models'
import { GATEWAY_VIDEO_MODEL_IDS } from '../video-models'
import { videoFamilyCaps, resolveVideoModelFamily } from './index'
import { MINIMAX_H3_MAX_VIDEO_MODEL_ID, MINIMAX_H3_VIDEO_MODEL_ID } from './minimax-h3'
import { withVideoReferenceTags } from '../../generators/video-clip'
import { preflightVideoGenerate } from '../../generators/video-preflight'

describe('MiniMax H3 family adapter (#1070)', () => {
  it('resolves H3 and H3 Max to minimax-h3 and keeps M3 a reasoner', () => {
    expect(resolveVideoModelFamily(MINIMAX_H3_VIDEO_MODEL_ID)).toBe('minimax-h3')
    expect(resolveVideoModelFamily(MINIMAX_H3_MAX_VIDEO_MODEL_ID)).toBe('minimax-h3')
    expect(resolveVideoModelFamily('minimax/minimax-m3')).toBe('unknown')
    expect(GATEWAY_REASONER_MODEL_IDS).toContain('minimax/minimax-m3')
    expect(GATEWAY_VIDEO_MODEL_IDS).not.toContain(MINIMAX_H3_VIDEO_MODEL_ID)
    expect(GATEWAY_VIDEO_MODEL_IDS).not.toContain(MINIMAX_H3_MAX_VIDEO_MODEL_ID)
  })

  it('uses 4–15s on H3 and 5–15s on H3 Max, not Veo 4/6/8', () => {
    const h3 = videoFamilyCaps(MINIMAX_H3_VIDEO_MODEL_ID)
    expect(h3.allowedDurations[0]).toBe(4)
    expect(h3.allowedDurations.at(-1)).toBe(15)
    expect(h3.allowedDurations).not.toEqual([4, 6, 8])
    expect(h3.maxInputImages).toBe(9)

    const max = videoFamilyCaps(MINIMAX_H3_MAX_VIDEO_MODEL_ID)
    expect(max.allowedDurations[0]).toBe(5)
    expect(max.allowedDurations.at(-1)).toBe(15)
    expect(max.maxInputImages).toBe(1)
    expect(max.maxInputVideos).toBe(0)
  })

  it('does not emit Seedance [Image n] tokens', () => {
    const tagged = withVideoReferenceTags(MINIMAX_H3_VIDEO_MODEL_ID, 'product walk', 3, 1)
    expect(tagged).toBe('product walk')
    expect(tagged).not.toMatch(/\[Image \d+\]/)
    expect(withVideoReferenceTags(MINIMAX_H3_MAX_VIDEO_MODEL_ID, 'walk', 2, 1)).toBe('walk')
  })

  it('rejects extra stills and video refs on H3 Max before spend', () => {
    const stills = preflightVideoGenerate({
      modelId: MINIMAX_H3_MAX_VIDEO_MODEL_ID,
      stillCount: 2,
    })
    expect(stills).toMatchObject({ ok: false, code: 'still_count' })
    if (stills.ok) throw new Error('expected fail')
    expect(stills.message).toMatch(/takes 1 still; you passed 2/)
    expect(stills.message).toMatch(/no credits used/)

    const videos = preflightVideoGenerate({
      modelId: MINIMAX_H3_MAX_VIDEO_MODEL_ID,
      stillCount: 1,
      videoCount: 1,
    })
    expect(videos).toMatchObject({ ok: false, code: 'video_count' })
    if (videos.ok) throw new Error('expected fail')
    expect(videos.message).toMatch(/stills only/)
    expect(videos.message).toMatch(/no credits used/)
  })

  it('allows H3 stills and video refs up to the family cap', () => {
    expect(
      preflightVideoGenerate({
        modelId: MINIMAX_H3_VIDEO_MODEL_ID,
        stillCount: 9,
        videoCount: 9,
      }),
    ).toEqual({ ok: true })
    expect(
      preflightVideoGenerate({
        modelId: MINIMAX_H3_MAX_VIDEO_MODEL_ID,
        stillCount: 1,
      }),
    ).toEqual({ ok: true })
  })
})
