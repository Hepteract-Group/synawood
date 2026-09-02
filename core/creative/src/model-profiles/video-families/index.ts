import { canonicalizeVideoModelId, GATEWAY_VIDEO_MODELS, isVideoOffModelId } from '../video-models'
import { seedanceFamilyCaps } from './seedance'
import type { VideoFamilyCaps, VideoModelFamily } from './types'
import { veoFamilyCaps } from './veo'
import { isMinimaxH3VideoModelId, minimaxH3FamilyCaps } from './minimax-h3'
import { isWan3VideoModelId, wan3FamilyCaps } from './wan3'

export { WAN3_GBP_PER_SECOND, WAN3_VIDEO_MODEL, WAN3_VIDEO_MODEL_ID } from './wan3'
export {
  MINIMAX_H3_GBP_PER_SECOND,
  MINIMAX_H3_MAX_GBP_PER_SECOND,
  MINIMAX_H3_MAX_VIDEO_MODEL,
  MINIMAX_H3_MAX_VIDEO_MODEL_ID,
  MINIMAX_H3_VIDEO_MODEL,
  MINIMAX_H3_VIDEO_MODEL_ID,
  isMinimaxH3MaxVideoModelId,
  isMinimaxH3VideoModelId,
} from './minimax-h3'
export type { VideoFamilyCaps, VideoModelFamily } from './types'

export const resolveVideoModelFamily = (modelId: string): VideoModelFamily => {
  const id = canonicalizeVideoModelId(modelId)
  if (isVideoOffModelId(id)) return 'unknown'
  if (isWan3VideoModelId(id)) return 'wan3'
  if (isMinimaxH3VideoModelId(id)) return 'minimax-h3'
  if (id.startsWith('google/veo')) return 'veo'
  if (id.startsWith('bytedance/seedance')) return 'seedance'
  return 'unknown'
}

export const videoFamilyCaps = (modelId: string): VideoFamilyCaps => {
  const id = canonicalizeVideoModelId(modelId)
  if (isWan3VideoModelId(id)) return wan3FamilyCaps()
  if (isMinimaxH3VideoModelId(id)) return minimaxH3FamilyCaps(id)

  const row = GATEWAY_VIDEO_MODELS.find((item) => item.gatewayModelId === id)
  if (row) {
    if (id.startsWith('google/veo')) return veoFamilyCaps(row.maxVideoSeconds)
    if (id.startsWith('bytedance/seedance')) return seedanceFamilyCaps(row.maxVideoSeconds)
  }

  if (isVideoOffModelId(id)) {
    const max = 50
    return {
      family: 'unknown',
      maxVideoSeconds: max,
      maxInputImages: 50,
      maxInputVideos: 50,
      allowedDurations: Array.from({ length: max }, (_, i) => i + 1),
      minDurationSeconds: 1,
    }
  }

  if (id.startsWith('google/veo')) return veoFamilyCaps(8)
  if (id.startsWith('bytedance/seedance-2.5')) return seedanceFamilyCaps(30)
  if (id.startsWith('bytedance/seedance')) return seedanceFamilyCaps(15)

  return veoFamilyCaps(8)
}
