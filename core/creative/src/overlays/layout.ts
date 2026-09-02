import type { OverlayLayout } from '../project/schema'

export const clampOverlayLayout = (layout: OverlayLayout): OverlayLayout => {
  const width = Math.min(1, Math.max(0.08, layout.width))
  const height = Math.min(1, Math.max(0.08, layout.height))
  const x = Math.min(1 - width, Math.max(0, layout.x))
  const y = Math.min(1 - height, Math.max(0, layout.y))
  return {
    x,
    y,
    width,
    height,
    rotation: layout.rotation ?? 0,
  }
}
