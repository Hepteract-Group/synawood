import type { VideoFamilyCaps } from './types'

const SEEDANCE_MIN_DURATION_SECONDS = 4

export const seedanceFamilyCaps = (maxVideoSeconds: number): VideoFamilyCaps => {
  const min = SEEDANCE_MIN_DURATION_SECONDS
  const max = Math.max(min, maxVideoSeconds)
  return {
    family: 'seedance',
    maxVideoSeconds: max,
    maxInputImages: maxVideoSeconds >= 30 ? 50 : 9,
    maxInputVideos: maxVideoSeconds >= 30 ? 50 : 9,
    allowedDurations: Array.from({ length: max - min + 1 }, (_, i) => min + i),
    minDurationSeconds: min,
  }
}
