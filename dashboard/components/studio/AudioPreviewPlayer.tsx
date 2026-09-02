'use client'

import { useEffect, useRef, useState } from 'react'

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  const m = Math.floor(whole / 60)
  const s = whole % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type AudioPreviewPlayerProps = {
  src: string
  label: string
  /** Pause this instance when another bed starts (Music panel list). */
  playingToken?: string | null
  onPlayingToken?: (token: string | null) => void
}

/** Compact Studio-owned audio controls — avoids browser download/overflow chrome. */
export const AudioPreviewPlayer = ({
  src,
  label,
  playingToken,
  onPlayingToken,
}: AudioPreviewPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tokenRef = useRef(`audio-${src}`)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    tokenRef.current = `audio-${src}`
    setFailed(false)
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
  }, [src])

  useEffect(() => {
    if (playingToken == null) return
    if (playingToken === tokenRef.current) return
    const el = audioRef.current
    if (el && !el.paused) el.pause()
  }, [playingToken])

  if (failed) {
    return <span className="asset-tile-glyph">Preview unavailable</span>
  }

  return (
    <div className="asset-audio-player">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime || 0)}
        onPlay={() => {
          setPlaying(true)
          onPlayingToken?.(tokenRef.current)
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          onPlayingToken?.(null)
        }}
        onError={() => setFailed(true)}
      />
      <button
        type="button"
        className="asset-audio-play"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        onClick={() => {
          const el = audioRef.current
          if (!el) return
          if (el.paused) void el.play()
          else el.pause()
        }}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <input
        className="asset-audio-scrub"
        type="range"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.05}
        value={Math.min(current, duration || 0)}
        aria-label={`Seek ${label}`}
        onChange={(event) => {
          const next = Number(event.target.value)
          const el = audioRef.current
          if (el) el.currentTime = next
          setCurrent(next)
        }}
      />
      <span className="asset-audio-time mono">
        {formatTime(current)}/{formatTime(duration)}
      </span>
    </div>
  )
}
