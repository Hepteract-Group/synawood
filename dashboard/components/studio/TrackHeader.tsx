'use client'

import type { ProjectTrack } from '@synawood/creative/project/client'
import { BROLL_TRACK_ID, SFX_TRACK_ID } from '@synawood/creative/project/tracks'
import type { ReactNode } from 'react'

type TrackHeaderProps = {
  track: ProjectTrack
  busy: boolean
  onToggleFlag: (flag: 'locked' | 'hidden' | 'muted') => void
  onCover?: () => void
  onVoiceover?: () => void
}

const FLAG_COPY = {
  locked: {
    on: 'Unlock: allow dragging and trimming clips on this track',
    off: 'Lock: prevent dragging and trimming clips on this track',
  },
  hidden: {
    on: 'Show: reveal this track lane in the timeline',
    off: 'Hide: collapse this track lane in the timeline',
  },
  muted: {
    on: 'Unmute: include this track’s audio on export/preview',
    off: 'Mute: silence this track on export/preview',
  },
} as const

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    className="track-flag-icon"
    viewBox="0 0 16 16"
    width="11"
    height="11"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
)

const LockIcon = ({ open }: { open: boolean }) => (
  <Icon>
    {open ? (
      <>
        <rect x="3.5" y="7" width="9" height="7" rx="1.2" />
        <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0" />
      </>
    ) : (
      <>
        <rect x="3.5" y="7" width="9" height="7" rx="1.2" />
        <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
      </>
    )}
  </Icon>
)

const EyeIcon = ({ hidden }: { hidden: boolean }) => (
  <Icon>
    {hidden ? (
      <>
        <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4Z" />
        <path d="M3 13 13 3" />
      </>
    ) : (
      <>
        <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4Z" />
        <circle cx="8" cy="8" r="1.6" />
      </>
    )}
  </Icon>
)

const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <Icon>
    <path d="M3 6.5h2.2L8.5 4v8L5.2 9.5H3z" />
    {muted ? (
      <path d="M11 6.5 14 9.5M14 6.5 11 9.5" />
    ) : (
      <path d="M10.5 6.2a2.4 2.4 0 0 1 0 3.6M12.2 4.8a4.2 4.2 0 0 1 0 6.4" />
    )}
  </Icon>
)

const CoverIcon = () => (
  <Icon>
    <rect x="2.5" y="3.5" width="11" height="9" rx="1.2" />
    <path d="M2.5 10.5 6 7.5l2.2 2.2 2-1.8 3.3 2.6" />
  </Icon>
)

const MicIcon = () => (
  <Icon>
    <rect x="6" y="2.5" width="4" height="7" rx="2" />
    <path d="M4.5 8.5a3.5 3.5 0 0 0 7 0M8 12v1.5M6 13.5h4" />
  </Icon>
)

const trackShortLabel = (track: ProjectTrack): string => {
  if (track.id === BROLL_TRACK_ID) return 'OVERLAY'
  if (track.id === SFX_TRACK_ID) return 'SFX'
  if (track.type === 'video') return 'MAIN'
  if (track.type === 'audio') return 'AUDIO'
  if (track.type === 'caption') return 'CAP'
  if (track.type === 'overlay') return 'FX'
  return track.type
}

export const TrackHeader = ({
  track,
  busy,
  onToggleFlag,
  onCover,
  onVoiceover,
}: TrackHeaderProps) => (
  <div className={`track-header track-header-${track.type}`} data-track-id={track.id}>
    <span
      className="track-label"
      title={
        track.id === BROLL_TRACK_ID
          ? 'Overlay picture on top of the main video'
          : track.id === SFX_TRACK_ID
            ? 'SFX: whooshes and hits under the picture'
            : track.type === 'video'
              ? 'MAIN: video clips. Motion ads play in the Player, not as a clip here.'
              : track.type === 'audio'
                ? 'AUDIO: music bed and voiceover'
                : track.type === 'caption'
                  ? 'CAP: captions track'
                  : 'FX: overlays track'
      }
    >
      {trackShortLabel(track)}
    </span>
    <div className="track-header-actions">
      <button
        type="button"
        className={`track-flag ${track.locked ? 'is-on' : ''}`}
        disabled={busy}
        title={FLAG_COPY.locked[track.locked ? 'on' : 'off']}
        aria-label={FLAG_COPY.locked[track.locked ? 'on' : 'off']}
        aria-pressed={track.locked}
        onClick={() => onToggleFlag('locked')}
      >
        <LockIcon open={!track.locked} />
      </button>
      <button
        type="button"
        className={`track-flag ${track.hidden ? 'is-on' : ''}`}
        disabled={busy}
        title={FLAG_COPY.hidden[track.hidden ? 'on' : 'off']}
        aria-label={FLAG_COPY.hidden[track.hidden ? 'on' : 'off']}
        aria-pressed={track.hidden}
        onClick={() => onToggleFlag('hidden')}
      >
        <EyeIcon hidden={track.hidden} />
      </button>
      <button
        type="button"
        className={`track-flag ${track.muted ? 'is-on' : ''}`}
        disabled={busy}
        title={FLAG_COPY.muted[track.muted ? 'on' : 'off']}
        aria-label={FLAG_COPY.muted[track.muted ? 'on' : 'off']}
        aria-pressed={track.muted}
        onClick={() => onToggleFlag('muted')}
      >
        <SpeakerIcon muted={track.muted} />
      </button>
      {track.type === 'video' && onCover ? (
        <button
          type="button"
          className="track-flag"
          disabled={busy}
          title="Cover: set the export thumbnail to the current playhead frame"
          aria-label="Cover: set the export thumbnail to the current playhead frame"
          onClick={onCover}
        >
          <CoverIcon />
        </button>
      ) : null}
      {track.type === 'audio' && track.id !== SFX_TRACK_ID && onVoiceover ? (
        <button
          type="button"
          className="track-flag"
          disabled={busy}
          title="Voiceover: ask the Studio Agent to generate spoken audio for this track"
          aria-label="Voiceover: ask the Studio Agent to generate spoken audio for this track"
          onClick={onVoiceover}
        >
          <MicIcon />
        </button>
      ) : null}
    </div>
  </div>
)
