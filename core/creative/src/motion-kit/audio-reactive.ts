/** Precomputed music energy → caption punch. Composition must not decode audio. */

export const AUDIO_REACTIVE_THRESHOLD = 0.55

/** Scale at this frame. Below threshold → 1 (no punch). Peak → > 1. */
export const audioReactiveScale = (
  energy: readonly number[] | undefined,
  frame: number,
  threshold = AUDIO_REACTIVE_THRESHOLD,
): number => {
  if (!energy || energy.length === 0) return 1
  const index = Math.min(energy.length - 1, Math.max(0, Math.floor(frame)))
  const sample = energy[index] ?? 0
  if (sample < threshold) return 1
  return 1 + Math.min(0.28, (sample - threshold) * 0.7)
}

export const audioReactiveFontWeight = (
  energy: readonly number[] | undefined,
  frame: number,
  threshold = AUDIO_REACTIVE_THRESHOLD,
): number => {
  const scale = audioReactiveScale(energy, frame, threshold)
  return scale > 1 ? 800 : 600
}
