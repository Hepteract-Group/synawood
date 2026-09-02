import type { ClipTreatment } from '../project/schema'

export type TreatmentStyle = {
  transform: string
  filter: string
  flashOpacity: number
  glowOpacity: number
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export const treatmentIsActive = (treatment: ClipTreatment, frame: number): boolean => {
  const start = treatment.from ?? 0
  if (frame < start) return false
  if (treatment.durationInFrames == null) return true
  return frame < start + treatment.durationInFrames
}

const punchScale = (frame: number, intensity: number): number => {
  const t = Math.min(1, Math.max(0, frame / 12))
  const ease = 1 - (1 - t) * (1 - t)
  return 1 + 0.08 * intensity * ease
}

export const styleForTreatments = (
  treatments: readonly ClipTreatment[] | undefined,
  frame: number,
): TreatmentStyle => {
  let x = 0
  let y = 0
  let scale = 1
  let filter = ''
  let flashOpacity = 0
  let glowOpacity = 0
  for (const treatment of treatments ?? []) {
    if (!treatmentIsActive(treatment, frame)) continue
    const intensity = clamp01(treatment.intensity)
    const local = frame - (treatment.from ?? 0)
    if (treatment.id === 'shake') {
      x += Math.sin(local * 1.7) * 8 * intensity
      y += Math.cos(local * 1.3) * 6 * intensity
    }
    if (treatment.id === 'zoom_punch') {
      scale *= punchScale(local, intensity)
    }
    if (treatment.id === 'glow') {
      glowOpacity = Math.max(glowOpacity, 0.35 * intensity)
      filter = [filter, `brightness(${1 + 0.18 * intensity})`].filter(Boolean).join(' ')
    }
    if (treatment.id === 'flash') {
      flashOpacity = Math.max(flashOpacity, clamp01(1 - local / 8) * intensity)
    }
  }
  const transform =
    x === 0 && y === 0 && scale === 1
      ? 'none'
      : `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`
  return { transform, filter, flashOpacity, glowOpacity }
}
