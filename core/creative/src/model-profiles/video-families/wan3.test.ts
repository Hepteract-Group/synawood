import { describe, expect, it } from 'vitest'
import {
  WAN3_GBP_PER_SECOND,
  WAN3_MAX_VIDEO_SECONDS,
  WAN3_VIDEO_MODEL,
  WAN3_VIDEO_MODEL_ID,
  withWanCharacterTokens,
} from './wan3'
import { videoFamilyCaps } from './index'

describe('Wan 3 family adapter (#1068)', () => {
  it('pins the Gateway id and vendor max duration (not Veo 8s)', () => {
    expect(WAN3_VIDEO_MODEL_ID).toBe('alibaba/wan-v3.0-video')
    expect(WAN3_VIDEO_MODEL.maxVideoSeconds).toBe(30)
    expect(WAN3_MAX_VIDEO_SECONDS).toBe(30)
    expect(WAN3_GBP_PER_SECOND).toBeGreaterThan(0)
  })

  it('allows 2–30s continuous snap, not Veo 4/6/8', () => {
    const caps = videoFamilyCaps(WAN3_VIDEO_MODEL_ID)
    expect(caps.allowedDurations[0]).toBe(2)
    expect(caps.allowedDurations.at(-1)).toBe(30)
    expect(caps.allowedDurations).not.toEqual([4, 6, 8])
    expect(caps.allowedDurations).toContain(15)
    expect(caps.allowedDurations).toContain(29)
  })

  it('uses character tokens, not Seedance [Image n]', () => {
    const tagged = withWanCharacterTokens('runway walk', 3, 1)
    expect(tagged).toMatch(/character1/)
    expect(tagged).toMatch(/character2/)
    expect(tagged).not.toMatch(/\[Image \d+\]/)
    expect(tagged).not.toMatch(/\[Video \d+\]/)
  })

  it('leaves single-still i2v prompts without ref tokens', () => {
    const tagged = withWanCharacterTokens('product reveal', 1, 0)
    expect(tagged).toBe('product reveal')
  })
})
