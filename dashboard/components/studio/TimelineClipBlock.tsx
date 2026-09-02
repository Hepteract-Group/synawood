'use client'

import type { ProjectClip, ProjectTrack } from '@synawood/creative/project/client'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ClipFilmstrip } from './ClipFilmstrip'
import { formatTimecode } from './timelineMath'
import { useAudioPeaks } from './useAudioPeaks'

type TimelineClipBlockProps = {
  clip: ProjectClip
  track: ProjectTrack
  visible: {
    from: number
    durationInFrames: number
  }
  width: number
  pixelsPerFrame: number
  label: string
  selected: boolean
  dragging: boolean
  locked: boolean
  busy: boolean
  isAudio: boolean
  mediaKind: 'video' | 'image' | 'audio' | 'other' | undefined
  projectId: string
  contentUrl: string | null
  posterUrl: string | null
  showFilmstrip: boolean
  inSceneFocus: boolean
  sceneDimmed: boolean
  onFailedFilmstrip: () => void
  onSelect: (additive: boolean) => void
  onBeginMove: (event: ReactPointerEvent<HTMLElement>) => void
  onBeginTrim: (event: ReactPointerEvent<HTMLElement>, edge: 'start' | 'end') => void
  onDelete: (ripple: boolean) => void
  deleteLeftPx: number
  startHandleLeftPx: number
  endHandleLeftPx: number
}

export const TimelineClipBlock = ({
  clip,
  track,
  visible,
  width,
  pixelsPerFrame,
  label,
  selected,
  dragging,
  locked,
  busy,
  isAudio,
  mediaKind,
  contentUrl,
  posterUrl,
  showFilmstrip,
  inSceneFocus,
  sceneDimmed,
  onFailedFilmstrip,
  onSelect,
  onBeginMove,
  onBeginTrim,
  onDelete,
  deleteLeftPx,
  startHandleLeftPx,
  endHandleLeftPx,
}: TimelineClipBlockProps) => {
  const barCount = Math.max(8, Math.round(width / 3))
  const { bars } = useAudioPeaks(isAudio ? contentUrl : null, clip.assetId, barCount)

  return (
    <div
      className={`clip-block ${isAudio ? 'clip-audio' : ''} ${showFilmstrip ? 'has-filmstrip' : ''} ${selected ? 'is-selected' : ''} ${dragging ? 'is-dragging' : ''} ${track.locked ? 'is-locked' : ''} ${inSceneFocus ? 'is-scene-focus' : ''} ${sceneDimmed ? 'is-scene-dimmed' : ''}`}
      style={{
        left: visible.from * pixelsPerFrame,
        width,
      }}
      role="button"
      tabIndex={0}
      title={`${label} · ${formatTimecode(visible.from)} → ${formatTimecode(visible.from + visible.durationInFrames)}${inSceneFocus ? ' · in selected scene' : ''}`}
      onPointerDown={onBeginMove}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(event.shiftKey)
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault()
          event.stopPropagation()
          if (!busy) onDelete(event.shiftKey)
        }
      }}
    >
      {showFilmstrip && contentUrl && (mediaKind === 'video' || mediaKind === 'image') ? (
        <ClipFilmstrip
          kind={posterUrl && mediaKind === 'video' ? 'image' : mediaKind}
          src={posterUrl && mediaKind === 'video' ? posterUrl : contentUrl}
          widthPx={width}
          label={label}
          onFailed={onFailedFilmstrip}
        />
      ) : null}
      {isAudio ? (
        <div className="clip-waveform" aria-hidden>
          {bars.map((height, index) => (
            <span key={index} style={{ height: `${Math.round(height * 100)}%` }} />
          ))}
        </div>
      ) : null}
      {!busy && !locked ? (
        <span
          className="clip-trim-handle is-start"
          role="separator"
          aria-label={`Trim start of ${label}`}
          style={{ left: startHandleLeftPx }}
          onPointerDown={(event) => onBeginTrim(event, 'start')}
        />
      ) : null}
      <span className={`clip-block-name ${isAudio ? 'clip-audio-label' : ''}`}>{label}</span>
      <span className="clip-block-time">{formatTimecode(visible.durationInFrames)}</span>
      {selected && !busy ? (
        <button
          type="button"
          className="clip-block-delete"
          style={{ left: deleteLeftPx, right: 'auto' }}
          title={
            isAudio
              ? 'Delete audio clip (Del). Shift+click for ripple delete.'
              : 'Delete clip (Del). Shift+click for ripple delete.'
          }
          aria-label={`Delete ${label}`}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDelete(event.shiftKey)
          }}
        >
          ×
        </button>
      ) : null}
      {!busy && !locked ? (
        <span
          className="clip-trim-handle is-end"
          role="separator"
          aria-label={`Trim end of ${label}`}
          style={{ left: endHandleLeftPx, right: 'auto' }}
          onPointerDown={(event) => onBeginTrim(event, 'end')}
        />
      ) : null}
    </div>
  )
}
