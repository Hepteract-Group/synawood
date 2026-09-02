/** ADR-0084 — per-family caps, duration snap, and prompt token syntax. */

export type VideoModelFamily = 'veo' | 'seedance' | 'wan3' | 'minimax-h3' | 'unknown'

export type VideoFamilyCaps = {
  family: VideoModelFamily
  maxVideoSeconds: number
  maxInputImages: number
  maxInputVideos: number
  /** Whole-second lengths the vendor accepts. Empty = any integer in [min, max]. */
  allowedDurations: readonly number[]
  /** Minimum whole seconds when allowedDurations is a continuous range. */
  minDurationSeconds: number
}
