/** Wave 2I / #517 / #572 — live Gateway video clip models (swappable). #1068/#1069 family adapters. */

import {
  resolveVideoModelFamily,
  videoFamilyCaps,
  WAN3_GBP_PER_SECOND,
  WAN3_VIDEO_MODEL,
  WAN3_VIDEO_MODEL_ID,
  MINIMAX_H3_MAX_VIDEO_MODEL,
  MINIMAX_H3_MAX_VIDEO_MODEL_ID,
  MINIMAX_H3_VIDEO_MODEL,
  MINIMAX_H3_VIDEO_MODEL_ID,
  isMinimaxH3MaxVideoModelId,
  isMinimaxH3VideoModelId,
} from './video-families'

export type GatewayVideoModel = {
  gatewayModelId: string
  label: string
  description: string
  /** Vendor max clip length. Do not cap below this when the model is selected (ADR-0048). */
  maxVideoSeconds: number
  /** Living £/sec estimate — confirmSpend still applies when > £0. */
  gbpPerSecond: number
  /** Vendor max stills per generate (first frame + refs). Fail over this — do not drop extras. */
  maxInputImages: number
  /** Vendor max video clips as references. 0 = stills only (Veo). */
  maxInputVideos: number
  /** Hosted wallet debit for this model (trial blocks when plan.paidHostedVideo is false). */
  paidHosted: boolean
}

export { WAN3_VIDEO_MODEL_ID, WAN3_VIDEO_MODEL, WAN3_GBP_PER_SECOND }
export {
  MINIMAX_H3_VIDEO_MODEL_ID,
  MINIMAX_H3_MAX_VIDEO_MODEL_ID,
  MINIMAX_H3_VIDEO_MODEL,
  MINIMAX_H3_MAX_VIDEO_MODEL,
}

/** Starter Gateway video id for paid short clips. Swap here only. */
export const STARTER_LIVE_VIDEO_MODEL_ID = 'google/veo-3.1-fast-generate-001' as const

export const STARTER_LIVE_VIDEO_GBP_PER_SECOND = 0.4

/** Dead / renamed Gateway ids → live ids. */
export const LEGACY_VIDEO_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'google/veo-3.1-fast-generate-preview': STARTER_LIVE_VIDEO_MODEL_ID,
}

/**
 * Studio Video picker rows. Labels are what the founder sees (ADR-0048 / ADR-0051).
 * Ids must exist on Vercel AI Gateway — a 404 here becomes a stills-only fake ad.
 * Wan 3 and MiniMax H3 land here after live smoke (#1070); adapter-only until then.
 */
export const GATEWAY_VIDEO_MODELS: readonly GatewayVideoModel[] = [
  {
    gatewayModelId: STARTER_LIVE_VIDEO_MODEL_ID,
    label: 'Veo 3.1 Fast',
    description: 'google/veo-3.1-fast-generate-001 — 4/6/8s, 1 still',
    maxVideoSeconds: 8,
    gbpPerSecond: STARTER_LIVE_VIDEO_GBP_PER_SECOND,
    maxInputImages: 1,
    maxInputVideos: 0,
    paidHosted: true,
  },
  {
    gatewayModelId: 'google/veo-3.1-generate-001',
    label: 'Veo 3.1',
    description: 'google/veo-3.1-generate-001 — higher quality, 4/6/8s, 1 still',
    maxVideoSeconds: 8,
    gbpPerSecond: 0.6,
    maxInputImages: 1,
    maxInputVideos: 0,
    paidHosted: true,
  },
  {
    gatewayModelId: 'bytedance/seedance-2.0-fast',
    label: 'Seedance 2.0 Fast',
    description: 'bytedance/seedance-2.0-fast — up to 15s, 9 stills, video refs',
    maxVideoSeconds: 15,
    gbpPerSecond: 0.2,
    maxInputImages: 9,
    maxInputVideos: 9,
    paidHosted: true,
  },
  {
    gatewayModelId: 'bytedance/seedance-2.5',
    label: 'Seedance 2.5',
    description: 'bytedance/seedance-2.5 — up to 30s, 4K, 50 stills, video refs',
    maxVideoSeconds: 30,
    gbpPerSecond: 0.5,
    maxInputImages: 50,
    maxInputVideos: 50,
    paidHosted: true,
  },
] as const

export const GATEWAY_VIDEO_MODEL_IDS: readonly string[] = GATEWAY_VIDEO_MODELS.map(
  (row) => row.gatewayModelId,
)

export const canonicalizeVideoModelId = (modelId: string): string =>
  LEGACY_VIDEO_MODEL_ALIASES[modelId] ?? modelId

export const isAllowlistedVideoModelId = (modelId: string): boolean => {
  const id = canonicalizeVideoModelId(modelId)
  return (
    id === 'disabled' ||
    id === 'mock-video' ||
    id === 'placeholder' ||
    id === WAN3_VIDEO_MODEL_ID ||
    isMinimaxH3VideoModelId(id) ||
    GATEWAY_VIDEO_MODEL_IDS.includes(id)
  )
}

export const isLiveVideoModelId = (modelId: string): boolean => {
  const id = canonicalizeVideoModelId(modelId)
  return (
    GATEWAY_VIDEO_MODEL_IDS.includes(id) ||
    id === WAN3_VIDEO_MODEL_ID ||
    id.startsWith('google/veo') ||
    id.startsWith('bytedance/seedance') ||
    id.startsWith('alibaba/wan-v3') ||
    isMinimaxH3VideoModelId(id)
  )
}

export const isVideoOffModelId = (modelId: string): boolean =>
  modelId === 'disabled' || modelId.startsWith('mock') || modelId.startsWith('placeholder')

/** True when this model would debit the hosted wallet (trial may block). */
export const isPaidHostedVideoModel = (modelId: string): boolean => {
  const id = canonicalizeVideoModelId(modelId)
  if (isVideoOffModelId(id)) return false
  const row = GATEWAY_VIDEO_MODELS.find((item) => item.gatewayModelId === id)
  if (row) return row.paidHosted
  if (id === WAN3_VIDEO_MODEL_ID) return true
  if (isMinimaxH3VideoModelId(id)) return true
  return isLiveVideoModelId(id)
}

export const videoModelMaxSeconds = (modelId: string): number =>
  videoFamilyCaps(modelId).maxVideoSeconds

export const videoModelLabel = (modelId: string): string => {
  const id = canonicalizeVideoModelId(modelId)
  if (id === WAN3_VIDEO_MODEL_ID) return WAN3_VIDEO_MODEL.label
  if (isMinimaxH3MaxVideoModelId(id)) return MINIMAX_H3_MAX_VIDEO_MODEL.label
  if (isMinimaxH3VideoModelId(id)) return MINIMAX_H3_VIDEO_MODEL.label
  return GATEWAY_VIDEO_MODELS.find((row) => row.gatewayModelId === id)?.label ?? id
}

/** Vendor stills cap. Stubs are generous so tests can pass N refs; unknown live models default to 1. */
export const videoModelMaxInputImages = (modelId: string): number =>
  videoFamilyCaps(modelId).maxInputImages

/** Seedance Gateway: 30MB per input image. */
export const VIDEO_MAX_INPUT_IMAGE_BYTES = 30 * 1024 * 1024

export const videoModelMaxInputVideos = (modelId: string): number =>
  videoFamilyCaps(modelId).maxInputVideos

/** Vendor-accepted clip lengths in whole seconds — family-specific (ADR-0084). */
export const videoModelAllowedDurations = (modelId: string): readonly number[] =>
  videoFamilyCaps(modelId).allowedDurations

/** Next allowed length at or above `want`. Overshoot is cheaper than a vendor reject. */
export const snapVideoDurationSeconds = (want: number, allowed: readonly number[]): number => {
  if (allowed.length === 0) return Math.max(1, Math.round(want))
  const rounded = Math.max(1, Math.round(want))
  const atLeast = allowed.find((seconds) => seconds >= rounded)
  return atLeast ?? allowed[allowed.length - 1]!
}

export const videoModelMaxInputImageBytes = (modelId: string): number | null => {
  const id = canonicalizeVideoModelId(modelId)
  if (isVideoOffModelId(id)) return null
  if (isLiveVideoModelId(id)) return VIDEO_MAX_INPUT_IMAGE_BYTES
  return null
}

export const resolveVideoModelId = (input: {
  profileVideoModelId: string
  videoModelId?: string | null
}): string => {
  const override = input.videoModelId?.trim()
  if (override && isAllowlistedVideoModelId(override) && !isVideoOffModelId(override)) {
    return canonicalizeVideoModelId(override)
  }
  return canonicalizeVideoModelId(input.profileVideoModelId)
}

export { resolveVideoModelFamily }
