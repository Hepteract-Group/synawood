export const CLIP_TRIM_HANDLE_PX = 14
export const CLIP_DELETE_PX = 20

export const timelineExtentFrames = (project: {
  durationFrames: number
  clips: Array<{ from: number; durationInFrames: number }>
  overlays: Array<{ from: number; durationInFrames: number }>
}): number => {
  const ends = [
    project.durationFrames,
    ...project.clips.map((clip) => clip.from + clip.durationInFrames),
    ...project.overlays.map((overlay) => overlay.from + overlay.durationInFrames),
  ]
  return Math.max(1, ...ends)
}

/** Pin trim handles and Delete inside the visible intersection of a clip and the scrollport. */
export const clipVisibleChrome = (input: {
  from: number
  durationInFrames: number
  viewportStartFrame: number
  viewportEndFrame: number
  pixelsPerFrame: number
}): {
  deleteLeftPx: number
  startHandleLeftPx: number
  endHandleLeftPx: number
} => {
  const ppf = Math.max(0.01, input.pixelsPerFrame)
  const clipEnd = input.from + Math.max(1, input.durationInFrames)
  const widthPx = Math.max(CLIP_TRIM_HANDLE_PX * 2, input.durationInFrames * ppf)
  const visibleStart = Math.min(clipEnd, Math.max(input.from, input.viewportStartFrame))
  const visibleEnd = Math.max(visibleStart, Math.min(clipEnd, input.viewportEndFrame))
  const visibleRightPx = (visibleEnd - input.from) * ppf
  const startHandleLeftPx = Math.max(0, (visibleStart - input.from) * ppf)
  const endHandleLeftPx = Math.min(
    widthPx - CLIP_TRIM_HANDLE_PX,
    Math.max(startHandleLeftPx + CLIP_TRIM_HANDLE_PX, visibleRightPx - CLIP_TRIM_HANDLE_PX),
  )
  const deleteLeftPx = Math.max(startHandleLeftPx + 4, endHandleLeftPx - CLIP_DELETE_PX)
  return { deleteLeftPx, startHandleLeftPx, endHandleLeftPx }
}
