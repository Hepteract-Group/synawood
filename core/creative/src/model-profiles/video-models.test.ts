import { describe, expect, it } from 'vitest'
import {
  canonicalizeVideoModelId,
  GATEWAY_VIDEO_MODEL_IDS,
  isAllowlistedVideoModelId,
  isLiveVideoModelId,
  isPaidHostedVideoModel,
  isVideoOffModelId,
  resolveVideoModelId,
  STARTER_LIVE_VIDEO_MODEL_ID,
  videoModelMaxInputImages,
  videoModelMaxInputVideos,
  snapVideoDurationSeconds,
  videoModelAllowedDurations,
  videoModelMaxSeconds,
  WAN3_VIDEO_MODEL_ID,
  MINIMAX_H3_VIDEO_MODEL_ID,
  MINIMAX_H3_MAX_VIDEO_MODEL_ID,
} from './video-models'

describe('live video model ids', () => {
  it('pins the starter to the live Veo Fast Gateway id, not the dead preview slug', () => {
    expect(STARTER_LIVE_VIDEO_MODEL_ID).toBe('google/veo-3.1-fast-generate-001')
    expect(canonicalizeVideoModelId('google/veo-3.1-fast-generate-preview')).toBe(
      STARTER_LIVE_VIDEO_MODEL_ID,
    )
  })

  it('allowlists Veo and Seedance Gateway ids', () => {
    expect(GATEWAY_VIDEO_MODEL_IDS).toContain('google/veo-3.1-fast-generate-001')
    expect(GATEWAY_VIDEO_MODEL_IDS).toContain('google/veo-3.1-generate-001')
    expect(GATEWAY_VIDEO_MODEL_IDS).toContain('bytedance/seedance-2.0-fast')
    expect(GATEWAY_VIDEO_MODEL_IDS).toContain('bytedance/seedance-2.5')
    expect(isAllowlistedVideoModelId('bytedance/seedance-2.5')).toBe(true)
    expect(isAllowlistedVideoModelId('google/veo-3.1-fast-generate-preview')).toBe(true)
    expect(isAllowlistedVideoModelId('not-a-model')).toBe(false)
  })

  it('treats Veo, Seedance, Wan 3, and the preview alias as live video', () => {
    expect(isLiveVideoModelId(STARTER_LIVE_VIDEO_MODEL_ID)).toBe(true)
    expect(isLiveVideoModelId('google/veo-3.0')).toBe(true)
    expect(isLiveVideoModelId('google/veo-3.1-fast-generate-preview')).toBe(true)
    expect(isLiveVideoModelId('bytedance/seedance-2.5')).toBe(true)
    expect(isLiveVideoModelId(WAN3_VIDEO_MODEL_ID)).toBe(true)
    expect(isLiveVideoModelId(MINIMAX_H3_VIDEO_MODEL_ID)).toBe(true)
    expect(isLiveVideoModelId(MINIMAX_H3_MAX_VIDEO_MODEL_ID)).toBe(true)
    expect(isLiveVideoModelId('minimax/minimax-m3')).toBe(false)
    expect(isLiveVideoModelId('google/lyria')).toBe(false)
    expect(isLiveVideoModelId('disabled')).toBe(false)
  })

  it('treats disabled, mock, and placeholder ids as video-off', () => {
    expect(isVideoOffModelId('disabled')).toBe(true)
    expect(isVideoOffModelId('mock-video')).toBe(true)
    expect(isVideoOffModelId('placeholder/cheap-video')).toBe(true)
    expect(isVideoOffModelId(STARTER_LIVE_VIDEO_MODEL_ID)).toBe(false)
  })

  it('treats live Gateway video as paid hosted and mocks as free (#1043)', () => {
    expect(isPaidHostedVideoModel(STARTER_LIVE_VIDEO_MODEL_ID)).toBe(true)
    expect(isPaidHostedVideoModel(WAN3_VIDEO_MODEL_ID)).toBe(true)
    expect(isPaidHostedVideoModel(MINIMAX_H3_VIDEO_MODEL_ID)).toBe(true)
    expect(isPaidHostedVideoModel(MINIMAX_H3_MAX_VIDEO_MODEL_ID)).toBe(true)
    expect(isPaidHostedVideoModel('mock-video')).toBe(false)
    expect(isPaidHostedVideoModel('disabled')).toBe(false)
  })

  it('uses the vendor max clip length, not a blanket 8s cap', () => {
    expect(videoModelMaxSeconds(STARTER_LIVE_VIDEO_MODEL_ID)).toBe(8)
    expect(videoModelMaxSeconds('google/veo-3.1-generate-001')).toBe(8)
    expect(videoModelMaxSeconds('bytedance/seedance-2.0-fast')).toBe(15)
    expect(videoModelMaxSeconds('bytedance/seedance-2.5')).toBe(30)
    expect(videoModelMaxSeconds('google/veo-3.1-fast-generate-preview')).toBe(8)
    expect(videoModelMaxSeconds(WAN3_VIDEO_MODEL_ID)).toBe(30)
    expect(videoModelMaxSeconds(MINIMAX_H3_VIDEO_MODEL_ID)).toBe(15)
    expect(videoModelMaxSeconds(MINIMAX_H3_MAX_VIDEO_MODEL_ID)).toBe(15)
  })

  it('lists vendor-allowed clip lengths (Seedance 4–15, Veo 4/6/8, Wan 2–30)', () => {
    expect(videoModelAllowedDurations('bytedance/seedance-2.0-fast')).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ])
    expect(videoModelAllowedDurations(STARTER_LIVE_VIDEO_MODEL_ID)).toEqual([4, 6, 8])
    expect(
      snapVideoDurationSeconds(2, videoModelAllowedDurations('bytedance/seedance-2.0-fast')),
    ).toBe(4)
    expect(
      snapVideoDurationSeconds(5, videoModelAllowedDurations(STARTER_LIVE_VIDEO_MODEL_ID)),
    ).toBe(6)
    expect(videoModelAllowedDurations('bytedance/seedance-2.5')[0]).toBe(4)
    expect(videoModelAllowedDurations('bytedance/seedance-2.5').at(-1)).toBe(30)
    expect(videoModelAllowedDurations(WAN3_VIDEO_MODEL_ID)[0]).toBe(2)
    expect(videoModelAllowedDurations(WAN3_VIDEO_MODEL_ID).at(-1)).toBe(30)
    expect(videoModelAllowedDurations(WAN3_VIDEO_MODEL_ID)).not.toEqual([4, 6, 8])
    expect(videoModelAllowedDurations(MINIMAX_H3_VIDEO_MODEL_ID)[0]).toBe(4)
    expect(videoModelAllowedDurations(MINIMAX_H3_VIDEO_MODEL_ID).at(-1)).toBe(15)
    expect(videoModelAllowedDurations(MINIMAX_H3_VIDEO_MODEL_ID)).not.toEqual([4, 6, 8])
    expect(videoModelAllowedDurations(MINIMAX_H3_MAX_VIDEO_MODEL_ID)[0]).toBe(5)
    expect(
      snapVideoDurationSeconds(4, videoModelAllowedDurations(MINIMAX_H3_MAX_VIDEO_MODEL_ID)),
    ).toBe(5)
  })

  it('pins vendor still caps (Veo 1, Seedance 2.0 Fast 9, Seedance 2.5 50)', () => {
    expect(videoModelMaxInputImages(STARTER_LIVE_VIDEO_MODEL_ID)).toBe(1)
    expect(videoModelMaxInputImages('bytedance/seedance-2.0-fast')).toBe(9)
    expect(videoModelMaxInputImages('bytedance/seedance-2.5')).toBe(50)
    expect(videoModelMaxInputImages('mock-video')).toBe(50)
    expect(videoModelMaxInputVideos(STARTER_LIVE_VIDEO_MODEL_ID)).toBe(0)
    expect(videoModelMaxInputVideos('bytedance/seedance-2.0-fast')).toBe(9)
    expect(videoModelMaxInputImages(MINIMAX_H3_VIDEO_MODEL_ID)).toBe(9)
    expect(videoModelMaxInputVideos(MINIMAX_H3_VIDEO_MODEL_ID)).toBe(9)
    expect(videoModelMaxInputImages(MINIMAX_H3_MAX_VIDEO_MODEL_ID)).toBe(1)
    expect(videoModelMaxInputVideos(MINIMAX_H3_MAX_VIDEO_MODEL_ID)).toBe(0)
  })

  it('allowlists Wan 3 adapter id before picker smoke', () => {
    expect(isAllowlistedVideoModelId(WAN3_VIDEO_MODEL_ID)).toBe(true)
    expect(GATEWAY_VIDEO_MODEL_IDS).not.toContain(WAN3_VIDEO_MODEL_ID)
  })

  it('allowlists MiniMax H3 adapters before picker smoke (#1070)', () => {
    expect(isAllowlistedVideoModelId(MINIMAX_H3_VIDEO_MODEL_ID)).toBe(true)
    expect(isAllowlistedVideoModelId(MINIMAX_H3_MAX_VIDEO_MODEL_ID)).toBe(true)
    expect(isAllowlistedVideoModelId('minimax/minimax-m3')).toBe(false)
    expect(GATEWAY_VIDEO_MODEL_IDS).not.toContain(MINIMAX_H3_VIDEO_MODEL_ID)
    expect(GATEWAY_VIDEO_MODEL_IDS).not.toContain(MINIMAX_H3_MAX_VIDEO_MODEL_ID)
  })

  it('prefers a persisted video override over the profile default', () => {
    expect(
      resolveVideoModelId({
        profileVideoModelId: STARTER_LIVE_VIDEO_MODEL_ID,
        videoModelId: 'bytedance/seedance-2.5',
      }),
    ).toBe('bytedance/seedance-2.5')
    expect(
      resolveVideoModelId({
        profileVideoModelId: 'google/veo-3.1-fast-generate-preview',
        videoModelId: null,
      }),
    ).toBe(STARTER_LIVE_VIDEO_MODEL_ID)
  })
})
