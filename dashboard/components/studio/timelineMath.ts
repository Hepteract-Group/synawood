export const TIMELINE_FPS = 30

/** Header column width — label + lock/eye/mute + cover or mic. CSS grid must match. */
export const TRACK_LABEL_WIDTH = 176

export const clampFrame = (frame: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(frame)))

export const formatTimecode = (frames: number, fps = TIMELINE_FPS): string => {
  const safe = Math.max(0, Math.floor(frames))
  const totalSeconds = Math.floor(safe / fps)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const frame = safe % fps
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frame).padStart(2, '0')}`
}

/** Compact mm:ss for tight player chrome. */
export const formatClock = (frames: number, fps = TIMELINE_FPS): string => {
  const safe = Math.max(0, Math.floor(frames))
  const totalSeconds = Math.floor(safe / fps)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Plain English beat window for Structure rails and Final snapshots. */
export const formatBeatWindow = (
  from: number,
  durationInFrames: number,
  fps = TIMELINE_FPS,
): string => `${formatClock(from, fps)}-${formatClock(from + durationInFrames, fps)}`

export const snapFrame = (frame: number, candidates: number[], thresholdFrames: number): number => {
  const nearest = candidates.reduce<{ frame: number; distance: number } | null>(
    (best, candidate) => {
      const distance = Math.abs(candidate - frame)
      return !best || distance < best.distance ? { frame: candidate, distance } : best
    },
    null,
  )
  return nearest && nearest.distance <= thresholdFrames ? nearest.frame : frame
}

export const TIMELINE_SEEK_BLOCK_CLASSES = [
  'clip-block',
  'clip-trim-handle',
  'clip-block-delete',
  'track-header',
  'timeline-toolbar',
] as const

const SEEK_BLOCK_TAGS = new Set(['BUTTON', 'INPUT', 'TEXTAREA', 'A', 'SUMMARY', 'LABEL'])

/**
 * Empty-lane / ruler clicks seek. Clip and overlay chrome must not.
 * Pass class names and tags from the event target up to (not including) the canvas.
 */
export const shouldSeekOnTimelinePointer = (input: {
  classNames: readonly string[]
  tags?: readonly string[]
}): boolean => {
  if (input.tags?.some((tag) => SEEK_BLOCK_TAGS.has(tag.toUpperCase()))) return false
  return !input.classNames.some((name) =>
    TIMELINE_SEEK_BLOCK_CLASSES.some((blocked) => ` ${name} `.includes(` ${blocked} `)),
  )
}

export const frameFromPointer = (
  clientX: number,
  laneLeft: number,
  scrollLeft: number,
  pixelsPerFrame: number,
): number => Math.round((clientX - laneLeft + scrollLeft) / pixelsPerFrame)

/** Slider left = fit entire project (1×). Slider right = deeper into time. */
export const ZOOM_FACTOR_MIN = 1
export const ZOOM_FACTOR_MAX = 24
/** Hard ceiling so frame-level zoom stays usable. */
export const PIXELS_PER_FRAME_MAX = 48

/** Pixels-per-frame so `durationFrames` exactly fills the lane (no artificial clamp). */
export const fitPixelsPerFrame = (
  durationFrames: number,
  laneWidthPx: number,
  paddingPx = 16,
): number => {
  const usable = Math.max(80, laneWidthPx - paddingPx)
  const frames = Math.max(1, durationFrames)
  return usable / frames
}

/** Effective timeline zoom from fit baseline × relative factor. */
export const pixelsPerFrameFromZoom = (fitPpf: number, zoomFactor: number): number => {
  const factor = Math.min(ZOOM_FACTOR_MAX, Math.max(ZOOM_FACTOR_MIN, zoomFactor))
  return Math.min(PIXELS_PER_FRAME_MAX, Math.max(0.02, fitPpf * factor))
}
