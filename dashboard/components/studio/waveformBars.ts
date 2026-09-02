/** Deterministic speech-like waveform heights (0–1) for an audio clip. */
export const waveformBars = (seed: string, count: number): number[] => {
  const bars = Math.max(4, Math.min(count, 256))
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const result: number[] = []
  for (let i = 0; i < bars; i += 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0
    const t = i / bars
    // Phrase bursts with quieter gaps — reads as attenuation, not noise.
    const phrase = 0.5 + 0.5 * Math.sin(t * Math.PI * 4.2 + (hash % 7))
    const syllable = 0.55 + 0.45 * Math.sin(t * Math.PI * 28 + (hash % 13))
    const gap = Math.sin(t * Math.PI * 2.1 + seed.length) > 0.35 ? 1 : 0.18
    const noise = (hash % 1000) / 1000
    const amplitude = phrase * syllable * gap * (0.35 + 0.65 * noise)
    result.push(Math.min(1, Math.max(0.06, amplitude)))
  }
  return result
}

/** Downsample absolute peaks from PCM channels into bar heights (0–1). */
export const peaksFromChannelData = (channels: Float32Array[], barCount: number): number[] => {
  const bars = Math.max(4, Math.min(barCount, 512))
  const length = channels[0]?.length ?? 0
  if (length === 0) return Array.from({ length: bars }, () => 0.08)

  const block = Math.max(1, Math.floor(length / bars))
  const result: number[] = []
  let peakMax = 0.0001

  for (let i = 0; i < bars; i += 1) {
    const start = i * block
    const end = Math.min(length, start + block)
    let peak = 0
    for (let sample = start; sample < end; sample += 1) {
      let mixed = 0
      for (const channel of channels) {
        mixed += Math.abs(channel[sample] ?? 0)
      }
      peak = Math.max(peak, mixed / Math.max(1, channels.length))
    }
    peakMax = Math.max(peakMax, peak)
    result.push(peak)
  }

  return result.map((value) => Math.min(1, Math.max(0.05, value / peakMax)))
}
