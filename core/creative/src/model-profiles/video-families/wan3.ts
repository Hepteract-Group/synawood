/** Wan 3 all-in-one — ADR-0084 / #1068. Gateway id alibaba/wan-v3.0-video (not wan3.0-video). */

import type { GatewayVideoModel } from '../video-models'
import type { VideoFamilyCaps } from './types'

export const WAN3_VIDEO_MODEL_ID = 'alibaba/wan-v3.0-video' as const

/** Vendor max single clip; do not cap at Veo 8s (ADR-0048 / 0084). */
export const WAN3_MAX_VIDEO_SECONDS = 30

/** Living £/sec estimate at 720p tier — confirmSpend still applies. */
export const WAN3_GBP_PER_SECOND = 0.08

/** Reference stills (first frame is separate in i2v). Scenario / Runware: up to 10. */
export const WAN3_MAX_INPUT_IMAGES = 10

/** Reference video clips. Vendor: up to 5. */
export const WAN3_MAX_INPUT_VIDEOS = 5

export const WAN3_MIN_DURATION_SECONDS = 2

/** Adapter row — not in GATEWAY_VIDEO_MODELS until live smoke (#1006 picker sibling). */
export const WAN3_VIDEO_MODEL: GatewayVideoModel = {
  gatewayModelId: WAN3_VIDEO_MODEL_ID,
  label: 'Wan 3.0',
  description: 'alibaba/wan-v3.0-video — up to 30s, character refs, video refs',
  maxVideoSeconds: WAN3_MAX_VIDEO_SECONDS,
  gbpPerSecond: WAN3_GBP_PER_SECOND,
  maxInputImages: WAN3_MAX_INPUT_IMAGES,
  maxInputVideos: WAN3_MAX_INPUT_VIDEOS,
  paidHosted: true,
}

export const isWan3VideoModelId = (modelId: string): boolean =>
  modelId === WAN3_VIDEO_MODEL_ID || modelId.startsWith('alibaba/wan-v3')

export const wan3FamilyCaps = (): VideoFamilyCaps => ({
  family: 'wan3',
  maxVideoSeconds: WAN3_MAX_VIDEO_SECONDS,
  maxInputImages: WAN3_MAX_INPUT_IMAGES,
  maxInputVideos: WAN3_MAX_INPUT_VIDEOS,
  allowedDurations: Array.from(
    { length: WAN3_MAX_VIDEO_SECONDS - WAN3_MIN_DURATION_SECONDS + 1 },
    (_, i) => WAN3_MIN_DURATION_SECONDS + i,
  ),
  minDurationSeconds: WAN3_MIN_DURATION_SECONDS,
})

/**
 * Wan 3 r2v tokens — character1, character2, … (not Seedance [Image n]).
 * First still is the i2v frame; extra stills and videos map to character indices.
 */
export const withWanCharacterTokens = (
  prompt: string,
  stillCount: number,
  videoCount = 0,
  continuing = false,
): string => {
  const extraStills = Math.max(0, stillCount - 1)
  const refCount = extraStills + videoCount
  if (refCount === 0) return prompt

  const bits: string[] = []
  if (extraStills >= 1) {
    const chars = Array.from({ length: extraStills }, (_, i) => `character${i + 1}`).join(', ')
    bits.push(
      `Keep ${chars} recognisable — same person, product, garment, and props as the reference stills.`,
    )
  }
  if (videoCount >= 1) {
    const videoChar = extraStills + 1
    bits.push(
      continuing
        ? `character${videoChar} is the previous shot of this ad. Continue that action; same people and wardrobe; do not start a new scene.`
        : `Use the reference video as motion guidance via character${videoChar}; keep garments from the stills recognisable.`,
    )
  }
  return `${bits.join(' ')} ${prompt}`
}
