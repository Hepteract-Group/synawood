'use client'

import type { PlayerRef } from '@remotion/player'
import {
  AUTHORED_IFRAME_ALLOW,
  AUTHORED_IFRAME_SANDBOX,
  AUTHORED_PLAYER_PATH,
  SYNAWOOD_AUTHORED_MESSAGE,
  authoredCompileBanner,
  authoredCoveredLastFrame,
  authoredPlayStartFrame,
  authoredPlayerSrcDoc,
  isMosAuthoredFromFrame,
} from '@synawood/creative/authored/client'
import {
  authoredAudioClock,
  authoredIframeInputProps,
  toAuthoredInputProps,
} from '@synawood/creative/authored/input-props'
import type { StudioProject } from '@synawood/creative/project/client'
import { voiceoverStartsAfterPicture } from '@synawood/creative/project/client'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  authoredBannerFingerprint,
  markAuthoredBannerDismissed,
  readAuthoredBannerDismissLevel,
} from '@/lib/authored-banner-dismiss'
import { IconX } from '../icons'

type AuthoredPreviewResponse = {
  error?: string
  compileError?: string | null
  code?: string
  inputProps?: Record<string, unknown>
  fps?: number
  width?: number
  height?: number
  durationInFrames?: number
  source?: string
}

type AuthoredPlayerPaneProps = {
  project: StudioProject
  playerRef: RefObject<PlayerRef | null>
  previewZoom: number
  onFrameUpdate: (frame: number) => void
  onPlayingChange: (isPlaying: boolean) => void
}

export const AuthoredPlayerPane = ({
  project,
  playerRef,
  previewZoom,
  onFrameUpdate,
  onPlayingChange,
}: AuthoredPlayerPaneProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const playingRef = useRef(false)
  const frameRef = useRef(0)
  const [compiling, setCompiling] = useState(true)
  const [compileError, setCompileError] = useState<string | null>(
    project.compositionSource?.compileError ?? null,
  )
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  const lastInitRef = useRef<Record<string, unknown> | null>(null)
  const [frameReady, setFrameReady] = useState(false)
  const [initEpoch, setInitEpoch] = useState(0)
  const [srcDoc, setSrcDoc] = useState<string | undefined>(undefined)

  const audioClips = useMemo(() => {
    const urlByBlobKey = new Map<string, string>()
    for (const asset of project.assets) {
      urlByBlobKey.set(
        asset.blobKey,
        `/api/studio/projects/${project.id}/assets/${asset.id}/content`,
      )
    }
    return toAuthoredInputProps(project, (key) => urlByBlobKey.get(key) ?? '').audioClips
  }, [project])

  const applyAudioClock = useCallback(
    (frame: number, playing: boolean) => {
      const rows = authoredAudioClock({
        clips: audioClips,
        fps: project.fps || 30,
        frame,
      })
      rows.forEach((row, index) => {
        const clip = audioClips[index]
        if (!clip) return
        const el = audioElsRef.current.get(`${clip.src}-${clip.from}`)
        if (!el) return
        if (Math.abs(el.currentTime - row.currentTime) > 0.25) {
          el.currentTime = row.currentTime
        }
        if (playing && row.active) {
          if (el.paused) void el.play().catch(() => undefined)
        } else if (!el.paused) {
          el.pause()
        }
      })
    },
    [audioClips, project.fps],
  )

  const syncAudio = useCallback(
    (frame: number, playing: boolean) => {
      frameRef.current = frame
      playingRef.current = playing
      applyAudioClock(frame, playing)
    },
    [applyAudioClock],
  )

  useEffect(() => {
    let cancelled = false
    void fetch(AUTHORED_PLAYER_PATH, { credentials: 'omit' })
      .then((response) => response.text())
      .then((html) => {
        if (cancelled) return
        setSrcDoc(authoredPlayerSrcDoc(html, window.location.origin))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setFrameReady(false)
  }, [srcDoc])

  const postToFrame = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, '*')
  }, [])

  const playFromClock = useCallback(() => {
    const duration = project.durationFrames
    const source = project.compositionSource?.source
    const covered = source ? authoredCoveredLastFrame(source, duration) : undefined
    const current = frameRef.current
    const start = authoredPlayStartFrame(current, duration, covered)
    if (start !== current) {
      postToFrame({ type: SYNAWOOD_AUTHORED_MESSAGE.seek, frame: start })
      onFrameUpdate(start)
    }
    syncAudio(start, true)
    postToFrame({ type: SYNAWOOD_AUTHORED_MESSAGE.play })
  }, [
    onFrameUpdate,
    postToFrame,
    project.compositionSource?.source,
    project.durationFrames,
    syncAudio,
  ])

  useEffect(() => {
    if (!frameReady || !lastInitRef.current) return
    postToFrame(lastInitRef.current)
  }, [frameReady, initEpoch, postToFrame])

  useEffect(() => {
    playerRef.current = {
      seekTo: (frame: number) => {
        syncAudio(frame, playingRef.current)
        postToFrame({ type: SYNAWOOD_AUTHORED_MESSAGE.seek, frame })
      },
      toggle: () => {
        if (playingRef.current) {
          syncAudio(frameRef.current, false)
          postToFrame({ type: SYNAWOOD_AUTHORED_MESSAGE.pause })
          return
        }
        playFromClock()
      },
      play: () => {
        playFromClock()
      },
      pause: () => {
        syncAudio(frameRef.current, false)
        postToFrame({ type: SYNAWOOD_AUTHORED_MESSAGE.pause })
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as PlayerRef
    return () => {
      playerRef.current = null
    }
  }, [playFromClock, playerRef, postToFrame, syncAudio])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (event.origin !== 'null' && event.origin !== window.location.origin) return
      if (!isMosAuthoredFromFrame(event.data)) return
      if (event.data.type === SYNAWOOD_AUTHORED_MESSAGE.ready) {
        setFrameReady(true)
        return
      }
      if (event.data.type === SYNAWOOD_AUTHORED_MESSAGE.frame) {
        setRuntimeError(null)
        syncAudio(event.data.frame, playingRef.current)
        onFrameUpdate(event.data.frame)
      }
      if (event.data.type === SYNAWOOD_AUTHORED_MESSAGE.playing) {
        syncAudio(frameRef.current, event.data.playing)
        onPlayingChange(event.data.playing)
      }
      if (event.data.type === SYNAWOOD_AUTHORED_MESSAGE.error) {
        setCompiling(false)
        setRuntimeError(event.data.message)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onFrameUpdate, onPlayingChange, syncAudio])

  useEffect(() => {
    let cancelled = false
    setCompiling(true)
    void (async () => {
      try {
        const response = await fetch(`/api/studio/projects/${project.id}/authored-preview`, {
          credentials: 'same-origin',
        })
        const body = (await response.json().catch(() => null)) as AuthoredPreviewResponse | null
        if (cancelled) return
        const error = body?.compileError ?? body?.error ?? (response.ok ? null : 'Preview failed')
        setCompileError(error)
        setRuntimeError(null)
        if (error || !body?.code) return
        const durationInFrames = body.durationInFrames ?? project.durationFrames
        const source = body.source ?? project.compositionSource?.source
        lastInitRef.current = {
          type: SYNAWOOD_AUTHORED_MESSAGE.init,
          code: body.code,
          inputProps: authoredIframeInputProps((body.inputProps ?? {}) as Record<string, unknown>),
          fps: body.fps ?? project.fps,
          width: body.width ?? project.width,
          height: body.height ?? project.height,
          durationInFrames,
          coveredLastFrame: source
            ? authoredCoveredLastFrame(source, durationInFrames)
            : Math.max(0, durationInFrames - 1),
        }
        setInitEpoch((epoch) => epoch + 1)
      } finally {
        if (!cancelled) setCompiling(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    project.id,
    project.revision,
    project.compositionSource?.source,
    project.fps,
    project.width,
    project.height,
    project.durationFrames,
  ])

  const banner = authoredCompileBanner({
    compiling,
    compileError,
    runtimeError,
    source: project.compositionSource?.source,
    voiceoverStartsAfterPicture: voiceoverStartsAfterPicture(project),
  })
  const fingerprint = banner ? authoredBannerFingerprint(banner.kind, banner.message) : ''
  const canDismiss = Boolean(banner && banner.kind !== 'building')
  const [dismissLevel, setDismissLevel] = useState<'none' | 'banner' | 'all'>('none')
  const [noteExpanded, setNoteExpanded] = useState(false)

  useEffect(() => {
    if (!canDismiss || !fingerprint) {
      setDismissLevel('none')
      setNoteExpanded(false)
      return
    }
    setDismissLevel(readAuthoredBannerDismissLevel(project.id, fingerprint))
    setNoteExpanded(false)
  }, [canDismiss, fingerprint, project.id])

  const width = project.width
  const height = project.height
  const showBanner = Boolean(
    banner && (banner.kind === 'building' || dismissLevel === 'none' || noteExpanded),
  )
  const showNoteChip = Boolean(canDismiss && dismissLevel === 'banner' && !noteExpanded)

  return (
    <div className="player-shell player-shell-compact">
      <div
        className="player-frame"
        style={{
          ['--player-ar-w' as string]: width,
          ['--player-ar-h' as string]: height,
          maxHeight: `${previewZoom * 100}%`,
        }}
      >
        {srcDoc ? (
          <iframe
            ref={iframeRef}
            className="authored-player-iframe"
            title="Motion preview"
            srcDoc={srcDoc}
            sandbox={AUTHORED_IFRAME_SANDBOX}
            allow={AUTHORED_IFRAME_ALLOW}
            referrerPolicy="no-referrer"
            onLoad={() => setFrameReady(true)}
          />
        ) : (
          <div className="authored-player-iframe" aria-hidden="true" />
        )}
        {audioClips.map((clip) => (
          <audio
            key={`${clip.src}-${clip.from}`}
            ref={(el) => {
              const key = `${clip.src}-${clip.from}`
              if (el) audioElsRef.current.set(key, el)
              else audioElsRef.current.delete(key)
            }}
            src={clip.src}
            preload="auto"
            playsInline
            className="sr-only"
          />
        ))}
      </div>
      {showNoteChip && banner ? (
        <div className="compile-status-toggle-row">
          <button
            type="button"
            className="cut-review-notes-toggle"
            aria-label="Show player note"
            onClick={() => setNoteExpanded(true)}
          >
            Player note
          </button>
          <button
            type="button"
            className="cut-review-notes-dismiss"
            aria-label="Hide player note"
            onClick={() => {
              markAuthoredBannerDismissed(project.id, fingerprint, 'all')
              setDismissLevel('all')
            }}
          >
            <IconX />
          </button>
        </div>
      ) : null}
      {showBanner && banner ? (
        <div
          className={`workspace-status-banner compile-status-banner ${banner.kind === 'building' ? 'is-busy' : 'is-failed'}`}
          role="status"
        >
          <p className="workspace-status-copy">{banner.message}</p>
          {canDismiss ? (
            <button
              type="button"
              className="cut-review-notes-dismiss"
              aria-label="Dismiss player note"
              onClick={() => {
                markAuthoredBannerDismissed(project.id, fingerprint, 'banner')
                setDismissLevel('banner')
                setNoteExpanded(false)
              }}
            >
              <IconX />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
