/** MiniMax H3 family — ADR-0093 / #1070. M3 is the reasoner, not video. */

import type { GatewayVideoModel } from '../video-models'
import type { VideoFamilyCaps } from './types'

export const MINIMAX_H3_VIDEO_MODEL_ID = 'minimax/minimax-h3' as const
export const MINIMAX_H3_MAX_VIDEO_MODEL_ID = 'minimax/minimax-h3-max' as const

export const MINIMAX_H3_MIN_DURATION_SECONDS = 4
export const MINIMAX_H3_MAX_VIDEO_SECONDS = 15
export const MINIMAX_H3_GBP_PER_SECOND = 0.15
/** First frame + inputReferences (images/video) up to 9. */
export const MINIMAX_H3_MAX_INPUT_IMAGES = 9
export const MINIMAX_H3_MAX_INPUT_VIDEOS = 9

export const MINIMAX_H3_MAX_MIN_DURATION_SECONDS = 5
export const MINIMAX_H3_MAX_MAX_VIDEO_SECONDS = 15
export const MINIMAX_H3_MAX_GBP_PER_SECOND = 0.07
/** t2v + start image only until smoke proves refs. */
export const MINIMAX_H3_MAX_MAX_INPUT_IMAGES = 1
export const MINIMAX_H3_MAX_MAX_INPUT_VIDEOS = 0

export const MINIMAX_H3_VIDEO_MODEL: GatewayVideoModel = {
  gatewayModelId: MINIMAX_H3_VIDEO_MODEL_ID,
  label: 'MiniMax H3',
  description: 'minimax/minimax-h3 — 4–15s, 2K, t2v / i2v / first-last / refs',
  maxVideoSeconds: MINIMAX_H3_MAX_VIDEO_SECONDS,
  gbpPerSecond: MINIMAX_H3_GBP_PER_SECOND,
  maxInputImages: MINIMAX_H3_MAX_INPUT_IMAGES,
  maxInputVideos: MINIMAX_H3_MAX_INPUT_VIDEOS,
  paidHosted: true,
}

export const MINIMAX_H3_MAX_VIDEO_MODEL: GatewayVideoModel = {
  gatewayModelId: MINIMAX_H3_MAX_VIDEO_MODEL_ID,
  label: 'MiniMax H3 Max',
  description: 'minimax/minimax-h3-max — 5–15s, 480p/768p, t2v + start image',
  maxVideoSeconds: MINIMAX_H3_MAX_MAX_VIDEO_SECONDS,
  gbpPerSecond: MINIMAX_H3_MAX_GBP_PER_SECOND,
  maxInputImages: MINIMAX_H3_MAX_MAX_INPUT_IMAGES,
  maxInputVideos: MINIMAX_H3_MAX_MAX_INPUT_VIDEOS,
  paidHosted: true,
}

export const isMinimaxH3VideoModelId = (modelId: string): boolean =>
  modelId === MINIMAX_H3_VIDEO_MODEL_ID || modelId === MINIMAX_H3_MAX_VIDEO_MODEL_ID

export const isMinimaxH3MaxVideoModelId = (modelId: string): boolean =>
  modelId === MINIMAX_H3_MAX_VIDEO_MODEL_ID

const durationRange = (min: number, max: number): number[] =>
  Array.from({ length: max - min + 1 }, (_, i) => min + i)

export const minimaxH3FamilyCaps = (modelId: string): VideoFamilyCaps => {
  if (isMinimaxH3MaxVideoModelId(modelId)) {
    return {
      family: 'minimax-h3',
      maxVideoSeconds: MINIMAX_H3_MAX_MAX_VIDEO_SECONDS,
      maxInputImages: MINIMAX_H3_MAX_MAX_INPUT_IMAGES,
      maxInputVideos: MINIMAX_H3_MAX_MAX_INPUT_VIDEOS,
      allowedDurations: durationRange(
        MINIMAX_H3_MAX_MIN_DURATION_SECONDS,
        MINIMAX_H3_MAX_MAX_VIDEO_SECONDS,
      ),
      minDurationSeconds: MINIMAX_H3_MAX_MIN_DURATION_SECONDS,
    }
  }
  return {
    family: 'minimax-h3',
    maxVideoSeconds: MINIMAX_H3_MAX_VIDEO_SECONDS,
    maxInputImages: MINIMAX_H3_MAX_INPUT_IMAGES,
    maxInputVideos: MINIMAX_H3_MAX_INPUT_VIDEOS,
    allowedDurations: durationRange(MINIMAX_H3_MIN_DURATION_SECONDS, MINIMAX_H3_MAX_VIDEO_SECONDS),
    minDurationSeconds: MINIMAX_H3_MIN_DURATION_SECONDS,
  }
}
