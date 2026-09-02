'use client'

import { useEffect, useRef, useState } from 'react'
import { useAudioPeaks } from './useAudioPeaks'

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  const m = Math.floor(whole / 60)
  const s = whole % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type AudioTilePreviewProps = {
  src: string
  seed: string
  label: string
}

/** Square Media-bin cover: waveform thumbnail + play, same size as stills. */
export const AudioTilePreview = ({ src, seed, label }: AudioTilePreviewProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { bars } = useAudioPeaks(src, seed, 18)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
  }, [src])

  if (failed) {
    return (
      <span className="asset-tile-glyph" role="img" aria-label={label}>
        Preview unavailable
      </span>
    )
  }

  return (
    <div className="audio-tile-preview">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <div className="audio-tile-wave" aria-hidden>
        {bars.map((height, index) => (
          <span key={index} style={{ height: `${Math.max(8, height * 100)}%` }} />
        ))}
      </div>
      <button
        type="button"
        className="audio-tile-play"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        onClick={(event) => {
          event.stopPropagation()
          event.preventDefault()
          const el = audioRef.current
          if (!el) return
          if (el.paused) void el.play()
          else el.pause()
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <span className="audio-tile-time mono">
        {formatTime(current)}/{formatTime(duration)}
      </span>
    </div>
  )
}
