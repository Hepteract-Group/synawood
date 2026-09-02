'use client'

import { IconMaximize, IconMinimize, IconPause, IconPlay, IconZoomReset } from '../icons'
import { formatClock } from './timelineMath'

type TransportProps = {
  currentFrame: number
  durationFrames: number
  isPlaying: boolean
  previewZoom: number
  isFullscreen: boolean
  onTogglePlay: () => void
  onSeek: (frame: number) => void
  onFullscreen: () => void
  onPreviewZoomChange: (zoom: number) => void
  onInsertTime?: () => void
}

export const Transport = ({
  currentFrame,
  durationFrames,
  isPlaying,
  previewZoom,
  isFullscreen,
  onTogglePlay,
  onSeek,
  onFullscreen,
  onPreviewZoomChange,
  onInsertTime,
}: TransportProps) => (
  <div className="player-transport" aria-label="Player transport">
    <span className="mono player-timecode">
      {formatClock(currentFrame)} / {formatClock(durationFrames)}
    </span>
    {onInsertTime ? (
      <button
        type="button"
        className="transport-icon-btn"
        onClick={onInsertTime}
        aria-label="Insert playhead time in chat"
        title="Insert playhead time in chat"
      >
        @
      </button>
    ) : null}
    <button
      type="button"
      className="transport-icon-btn"
      onClick={onTogglePlay}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      title={isPlaying ? 'Pause' : 'Play'}
    >
      {isPlaying ? <IconPause /> : <IconPlay />}
    </button>
    <div className="transport-scrubber-wrap">
      <input
        className="transport-scrubber"
        type="range"
        min={0}
        max={Math.max(0, (Number.isFinite(durationFrames) ? durationFrames : 1) - 1)}
        value={Math.min(
          Number.isFinite(currentFrame) ? currentFrame : 0,
          Math.max(0, (Number.isFinite(durationFrames) ? durationFrames : 1) - 1),
        )}
        onChange={(event) => onSeek(Number(event.target.value))}
        aria-label="Playhead"
        title="Scrub playhead"
      />
    </div>
    <label className="transport-zoom" title={`Preview zoom ${Math.round(previewZoom * 100)}%`}>
      <span className="sr-only">Zoom</span>
      <input
        type="range"
        min={0.5}
        max={1.25}
        step={0.05}
        value={previewZoom}
        onChange={(event) => onPreviewZoomChange(Number(event.target.value))}
        aria-label="Preview zoom"
      />
    </label>
    <button
      type="button"
      className="transport-icon-btn"
      onClick={() => onPreviewZoomChange(1)}
      aria-label="Reset zoom"
      title="Reset zoom"
    >
      <IconZoomReset />
    </button>
    <button
      type="button"
      className="transport-icon-btn"
      onClick={onFullscreen}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen player'}
      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
    >
      {isFullscreen ? <IconMinimize /> : <IconMaximize />}
    </button>
  </div>
)
