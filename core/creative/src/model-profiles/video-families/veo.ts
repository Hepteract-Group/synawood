import type { VideoFamilyCaps } from './types'

export const VEO_DURATION_SNAP = [4, 6, 8] as const

export const veoFamilyCaps = (maxVideoSeconds: number): VideoFamilyCaps => ({
  family: 'veo',
  maxVideoSeconds,
  maxInputImages: 1,
  maxInputVideos: 0,
  allowedDurations: VEO_DURATION_SNAP.filter((seconds) => seconds <= maxVideoSeconds),
  minDurationSeconds: 4,
})
