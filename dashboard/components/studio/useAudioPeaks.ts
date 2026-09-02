'use client'

import { useEffect, useState } from 'react'
import { closeAudioContextOnce } from './closeAudioContextOnce'
import { peaksFromChannelData, waveformBars } from './waveformBars'

const peakCache = new Map<string, number[]>()

type AudioPeaksState = {
  bars: number[]
  source: 'decoded' | 'synthetic'
}

/**
 * Prefer real decoded peaks from the asset content URL; fall back to a
 * speech-like synthetic envelope while loading or if decode fails.
 */
export const useAudioPeaks = (
  sourceUrl: string | null,
  seed: string,
  barCount: number,
): AudioPeaksState => {
  const synthetic = waveformBars(seed, barCount)
  const [decoded, setDecoded] = useState<number[] | null>(() => {
    if (!sourceUrl) return null
    const cached = peakCache.get(sourceUrl)
    if (!cached) return null
    return resamplePeaks(cached, barCount)
  })

  useEffect(() => {
    if (!sourceUrl) {
      setDecoded(null)
      return
    }
    const cached = peakCache.get(sourceUrl)
    if (cached) {
      setDecoded(resamplePeaks(cached, barCount))
      return
    }

    let cancelled = false
    const AudioCtx =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const closeOnce = closeAudioContextOnce(ctx)
    void (async () => {
      try {
        const response = await fetch(sourceUrl)
        if (!response.ok) throw new Error(`audio ${response.status}`)
        const buffer = await response.arrayBuffer()
        const audio = await ctx.decodeAudioData(buffer.slice(0))
        const channels = Array.from({ length: audio.numberOfChannels }, (_, index) =>
          audio.getChannelData(index),
        )
        // Store a high-resolution master peak strip; resample per zoom.
        const master = peaksFromChannelData(channels, 512)
        peakCache.set(sourceUrl, master)
        if (!cancelled) setDecoded(resamplePeaks(master, barCount))
      } catch {
        if (!cancelled) setDecoded(null)
      } finally {
        closeOnce()
      }
    })()

    return () => {
      cancelled = true
      closeOnce()
    }
  }, [sourceUrl, barCount, seed])

  return {
    bars: decoded ?? synthetic,
    source: decoded ? 'decoded' : 'synthetic',
  }
}

const resamplePeaks = (master: number[], barCount: number): number[] => {
  const bars = Math.max(4, Math.min(barCount, 512))
  if (master.length === bars) return master
  const result: number[] = []
  for (let i = 0; i < bars; i += 1) {
    const start = Math.floor((i / bars) * master.length)
    const end = Math.max(start + 1, Math.floor(((i + 1) / bars) * master.length))
    let peak = 0
    for (let j = start; j < end; j += 1) peak = Math.max(peak, master[j] ?? 0)
    result.push(peak)
  }
  return result
}
