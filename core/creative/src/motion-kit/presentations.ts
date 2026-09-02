/** Frame-driven SceneWipe silhouettes. No CSS animation / transition. */

export const MOTION_TRANSITION_FAMILIES = ['fade', 'slide', 'iris', 'brand-wipe', 'star'] as const

export type MotionTransitionFamily = (typeof MOTION_TRANSITION_FAMILIES)[number]

export const sceneWipeProgress = (frame: number, durationInFrames = 18): number => {
  if (durationInFrames <= 1) return 1
  const t = frame / durationInFrames
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t
}

const starPolygon = (progress: number): string => {
  const scale = Math.max(0.02, progress)
  const points: string[] = []
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI / 2) * -1 + (i * Math.PI) / 5
    const radius = (i % 2 === 0 ? 50 : 20) * scale
    const x = 50 + Math.cos(angle) * radius
    const y = 50 + Math.sin(angle) * radius
    points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`)
  }
  return `polygon(${points.join(', ')})`
}

export type SceneWipeStyle = {
  opacity: number
  clipPath: string
  transform: string
  backgroundColor?: string
}

/** Path progress at a given 0–1. Mid-transition silhouettes must differ per id. */
export const sceneWipeStyle = (input: {
  presentationId: MotionTransitionFamily
  progress: number
  brandColor?: string
}): SceneWipeStyle => {
  const p = Math.min(1, Math.max(0, input.progress))
  const brand = input.brandColor ?? '#1f6b4a'
  switch (input.presentationId) {
    case 'fade':
      return { opacity: p, clipPath: 'none', transform: 'none' }
    case 'slide':
      return {
        opacity: 1,
        clipPath: `inset(0 ${Math.round((1 - p) * 100)}% 0 0)`,
        transform: `translateX(${Math.round((1 - p) * -48)}px)`,
      }
    case 'iris':
      return {
        opacity: 1,
        clipPath: `circle(${Math.round(p * 80)}% at 50% 50%)`,
        transform: 'none',
      }
    case 'brand-wipe':
      return {
        opacity: 1,
        clipPath: `polygon(0 0, ${Math.round(p * 100)}% 0, ${Math.round(p * 100)}% 100%, 0 100%)`,
        transform: 'none',
        backgroundColor: brand,
      }
    case 'star':
      return { opacity: 1, clipPath: starPolygon(p), transform: 'none' }
  }
}
