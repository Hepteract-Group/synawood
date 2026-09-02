'use client'

import type {
  PipLayout,
  PipPresetId,
  ProjectClip,
  ProjectTrack,
  StudioMutation,
  StudioProject,
} from '@synawood/creative/project/client'
import {
  BROLL_TRACK_ID,
  MAIN_VIDEO_TRACK_ID,
  SFX_TRACK_ID,
  defaultOverlayLayout,
  isAuthoredComposition,
  overlaysForTrack,
  resolveMagneticClipFrom,
  trackTypeForOverlayKind,
} from '@synawood/creative/project/client'
import {
  authoredMotionSpanLayout,
  authoredSequenceCoverage,
} from '@synawood/creative/authored/client'
import {
  parseStickerDrag,
  parseTextPresetDrag,
  STICKER_PRESET_MIME,
  TEXT_PRESET_MIME,
  TEXT_PRESETS,
  getTextPreset,
} from '@synawood/creative/overlays'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  IconCollapsePanel,
  IconFitDuration,
  IconMinimize,
  IconRedo,
  IconRipple,
  IconScissors,
  IconSelectLeft,
  IconSelectRight,
  IconTrash,
  IconUndo,
  IconX,
} from '../icons'
import { TimelineClipBlock } from './TimelineClipBlock'
import { TrackHeader } from './TrackHeader'
import { PaneCollapseControl } from './PaneChrome'
import { PipLayoutInspector } from './PipLayoutInspector'
import { clipTimelineLabel } from '../../lib/timeline-clip-label'
import { clipVisibleChrome, timelineExtentFrames } from './timelineClipLayout'
import {
  clampFrame,
  fitPixelsPerFrame,
  formatTimecode,
  frameFromPointer,
  pixelsPerFrameFromZoom,
  shouldSeekOnTimelinePointer,
  snapFrame,
  TIMELINE_FPS,
  TRACK_LABEL_WIDTH,
  ZOOM_FACTOR_MAX,
  ZOOM_FACTOR_MIN,
} from './timelineMath'
import { buildRulerTicks, trailingRulerFrames } from './timelineRuler'

type TimelineSelection = {
  clips: string[]
  overlays: string[]
}

type TimelineProps = {
  project: StudioProject
  projectId: string
  currentFrame: number
  locked: boolean
  mutationPending: boolean
  canUndo: boolean
  canRedo: boolean
  onSeek: (frame: number) => void
  onMutate: (mutation: StudioMutation) => Promise<void>
  onUndo: () => void
  onRedo: () => void
  onRequestVoiceover?: (script: string) => void
  onCollapse?: () => void
  /** When set, belonging Video clips light up and others dim (scene ↔ clip map). */
  focusedSceneId?: string | null
  onClipSelectionChange?: (clipIds: string[]) => void
  onOverlaySelectionChange?: (overlayIds: string[]) => void
  onRequestSuggestions?: () => void
  pipLayout?: PipLayout
  hasPipClips?: boolean
  onPipLayoutPreset?: (id: PipPresetId) => void
  onPipLayoutChange?: (layout: PipLayout) => void
  onPlaceSticker?: (stickerId: string, from: number) => void
}

type ClipDraft = {
  clipId: string
  from: number
  durationInFrames: number
  trimStartFrames: number
}

type OverlayDraft = {
  overlayId: string
  from: number
  durationInFrames: number
}

const MIN_CLIP_FRAMES = 3
const MIN_OVERLAY_FRAMES = 3
const emptySelection = (): TimelineSelection => ({ clips: [], overlays: [] })

const assetContentUrl = (projectId: string, assetId: string): string =>
  `/api/studio/projects/${projectId}/assets/${assetId}/content`

const assetPosterUrl = (
  projectId: string,
  asset: { id: string; probe?: Record<string, unknown> } | undefined,
): string | null => {
  const key = asset?.probe?.posterBlobKey
  if (typeof key !== 'string' || !key) return null
  return `${assetContentUrl(projectId, asset.id)}?variant=poster`
}

const overlayStyle: Record<string, string> = {
  hook_title: 'var(--sw-accent)',
  caption: '#5a7fae',
  end_card: '#b07f3f',
  sticker: 'var(--sw-accent)',
  title: '#8a6bb5',
}

export const Timeline = ({
  project,
  projectId,
  currentFrame,
  locked,
  mutationPending,
  canUndo,
  canRedo,
  onSeek,
  onMutate,
  onUndo,
  onRedo,
  onRequestVoiceover,
  onCollapse,
  focusedSceneId = null,
  onClipSelectionChange,
  onOverlaySelectionChange,
  onRequestSuggestions,
  pipLayout,
  hasPipClips = false,
  onPipLayoutPreset,
  onPipLayoutChange,
  onPlaceSticker,
}: TimelineProps) => {
  const [selection, setSelection] = useState<TimelineSelection>(emptySelection)
  /** Relative to fit: 1 = entire timeline visible, higher = zoom into time. */
  const [zoomFactor, setZoomFactor] = useState(ZOOM_FACTOR_MIN)
  const [laneWidthPx, setLaneWidthPx] = useState(0)
  const [draft, setDraft] = useState<ClipDraft | null>(null)
  const [overlayDraft, setOverlayDraft] = useState<OverlayDraft | null>(null)
  const [overlayCopy, setOverlayCopy] = useState('')
  const [overlayCopyError, setOverlayCopyError] = useState<string | null>(null)
  const [dropFrame, setDropFrame] = useState<number | null>(null)
  const [failedFilmstrips, setFailedFilmstrips] = useState(() => new Set<string>())
  const [scrollLeft, setScrollLeft] = useState(0)
  const [inspectorMinimized, setInspectorMinimized] = useState(false)
  const [inspectorDismissed, setInspectorDismissed] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const busy = mutationPending
  const onClipSelectionChangeRef = useRef(onClipSelectionChange)
  onClipSelectionChangeRef.current = onClipSelectionChange
  const onOverlaySelectionChangeRef = useRef(onOverlaySelectionChange)
  onOverlaySelectionChangeRef.current = onOverlaySelectionChange

  useEffect(() => {
    onClipSelectionChangeRef.current?.(selection.clips)
  }, [selection.clips])
  useEffect(() => {
    onOverlaySelectionChangeRef.current?.(selection.overlays)
  }, [selection.overlays])

  useEffect(() => {
    const overlay = project.overlays.find((item) => item.id === selection.overlays[0])
    setOverlayCopy(overlay?.text ?? '')
    setOverlayCopyError(null)
  }, [selection.overlays, project.overlays])

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return

    const measure = () => {
      const next = Math.max(0, scroll.clientWidth - TRACK_LABEL_WIDTH)
      setLaneWidthPx((current) => (Math.abs(current - next) < 1 ? current : next))
      setScrollLeft(scroll.scrollLeft)
    }

    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(scroll)
    window.addEventListener('resize', measure)
    scroll.addEventListener('scroll', measure, { passive: true })
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
      scroll.removeEventListener('scroll', measure)
    }
  }, [])

  const extentFrames = useMemo(() => timelineExtentFrames(project), [project])
  const fitPpf = useMemo(
    () => (laneWidthPx > 40 ? fitPixelsPerFrame(extentFrames, laneWidthPx) : 0.5),
    [laneWidthPx, extentFrames],
  )
  const pixelsPerFrame = pixelsPerFrameFromZoom(fitPpf, zoomFactor)
  const isFitZoom = zoomFactor <= ZOOM_FACTOR_MIN + 0.001

  const applyFitZoom = () => setZoomFactor(ZOOM_FACTOR_MIN)

  const focusClipIds = useMemo(() => {
    if (!focusedSceneId) return null
    const scene = project.scenes.find((item) => item.id === focusedSceneId)
    return new Set(scene?.clipIds ?? [])
  }, [focusedSceneId, project.scenes])
  const sceneFocusActive = focusClipIds !== null

  const assetById = useMemo(
    () => new Map(project.assets.map((asset) => [asset.id, asset])),
    [project.assets],
  )
  const trackById = useMemo(
    () => new Map(project.tracks.map((track) => [track.id, track])),
    [project.tracks],
  )
  const orderedTracks = useMemo(
    () => [...project.tracks].sort((a, b) => a.order - b.order),
    [project.tracks],
  )
  const selectedClips = project.clips.filter((clip) => selection.clips.includes(clip.id))
  const selectedOverlays = project.overlays.filter((overlay) =>
    selection.overlays.includes(overlay.id),
  )
  const primaryClip = selectedClips[0]
  const primaryOverlay = selectedOverlays[0]
  const hasSelection = selection.clips.length + selection.overlays.length > 0
  const inspectorKey = selection.clips[0] ?? selection.overlays[0] ?? ''

  useEffect(() => {
    setInspectorMinimized(false)
    setInspectorDismissed(false)
  }, [inspectorKey])
  const canSplit =
    selectedClips.length === 1 &&
    primaryClip !== undefined &&
    currentFrame > primaryClip.from &&
    currentFrame < primaryClip.from + primaryClip.durationInFrames
  const snapCandidates = useMemo(
    () => [
      0,
      currentFrame,
      ...project.clips.flatMap((clip) => [clip.from, clip.from + clip.durationInFrames]),
    ],
    [currentFrame, project.clips],
  )
  const trailFrames = isFitZoom
    ? Math.max(1, Math.round(8 / Math.max(0.02, pixelsPerFrame)))
    : trailingRulerFrames(pixelsPerFrame)
  const durationWidth = isFitZoom
    ? (extentFrames + trailFrames) * pixelsPerFrame
    : Math.max(640, (extentFrames + trailFrames) * pixelsPerFrame)
  const canvasWidth = TRACK_LABEL_WIDTH + durationWidth
  const rulerEndFrame = extentFrames + trailFrames
  const ticks = useMemo(
    () =>
      buildRulerTicks({
        endFrame: rulerEndFrame,
        pixelsPerFrame,
      }),
    [rulerEndFrame, pixelsPerFrame],
  )

  const labelFor = (clipId: string) => {
    const clip = project.clips.find((item) => item.id === clipId)
    const asset = clip ? assetById.get(clip.assetId) : undefined
    return clipTimelineLabel(asset)
  }

  const trackLocked = (trackId: string) => trackById.get(trackId)?.locked === true

  const snapped = (frame: number, excludeClipId?: string) => {
    const candidates = excludeClipId
      ? snapCandidates.filter((candidate) => {
          const clip = project.clips.find((item) => item.id === excludeClipId)
          return (
            !clip || (candidate !== clip.from && candidate !== clip.from + clip.durationInFrames)
          )
        })
      : snapCandidates
    return snapFrame(frame, candidates, Math.max(1, Math.round(8 / pixelsPerFrame)))
  }

  const pointerFrame = (clientX: number) => {
    const scroll = scrollRef.current
    if (!scroll) return 0
    const rect = scroll.getBoundingClientRect()
    return clampFrame(
      frameFromPointer(clientX, rect.left + TRACK_LABEL_WIDTH, scroll.scrollLeft, pixelsPerFrame),
      0,
      project.durationFrames - 1,
    )
  }

  const seekFromEmptyPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (busy) return
    const classNames: string[] = []
    const tags: string[] = []
    let node: Element | null = event.target instanceof Element ? event.target : null
    while (node && node !== event.currentTarget) {
      classNames.push([...node.classList].join(' '))
      tags.push(node.tagName)
      node = node.parentElement
    }
    if (!shouldSeekOnTimelinePointer({ classNames, tags })) return
    onSeek(snapped(pointerFrame(event.clientX)))
  }

  const selectClip = (clipId: string, additive = false) => {
    setInspectorDismissed(false)
    setSelection((current) =>
      additive
        ? {
            clips: current.clips.includes(clipId)
              ? current.clips.filter((id) => id !== clipId)
              : [...current.clips, clipId],
            overlays: current.overlays,
          }
        : { clips: [clipId], overlays: [] },
    )
  }

  const selectOverlay = (overlayId: string, additive = false) => {
    setInspectorDismissed(false)
    setSelection((current) =>
      additive
        ? {
            clips: current.clips,
            overlays: current.overlays.includes(overlayId)
              ? current.overlays.filter((id) => id !== overlayId)
              : [...current.overlays, overlayId],
          }
        : { clips: [], overlays: [overlayId] },
    )
  }

  const selectRelativeToPlayhead = (side: 'left' | 'right') => {
    const clips = project.clips
      .filter((clip) =>
        side === 'left'
          ? clip.from + clip.durationInFrames <= currentFrame
          : clip.from >= currentFrame,
      )
      .map((clip) => clip.id)
    const overlays = project.overlays
      .filter((overlay) =>
        side === 'left'
          ? overlay.from + overlay.durationInFrames <= currentFrame
          : overlay.from >= currentFrame,
      )
      .map((overlay) => overlay.id)
    setSelection({ clips, overlays })
  }

  const bindPointerGesture = (
    event: ReactPointerEvent<HTMLElement>,
    onMove: (deltaFrames: number, clientX: number) => void,
    onCommit: () => void,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const target = event.currentTarget
    const pointerId = event.pointerId
    const startX = event.clientX
    try {
      target.setPointerCapture(pointerId)
    } catch {
      // Pointer already released (fast tap) — element listeners still cover the gesture.
    }
    const move = (next: PointerEvent) =>
      onMove(Math.round((next.clientX - startX) / pixelsPerFrame), next.clientX)
    const finish = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', finish)
      target.removeEventListener('pointercancel', finish)
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
      onCommit()
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', finish)
    target.addEventListener('pointercancel', finish)
  }

  const beginMove = (event: ReactPointerEvent<HTMLElement>, clipId: string) => {
    if (busy || locked) return
    const clip = project.clips.find((item) => item.id === clipId)
    if (!clip) return
    selectClip(clipId, event.shiftKey)
    // Locked tracks can still be selected/deleted — only drag/trim is blocked.
    if (trackLocked(clip.trackId)) return
    let nextFrom = clip.from
    bindPointerGesture(
      event,
      (delta) => {
        const raw = clampFrame(
          snapped(clip.from + delta, clip.id),
          0,
          Math.max(0, project.durationFrames + clip.durationInFrames),
        )
        nextFrom = resolveMagneticClipFrom(project, {
          trackId: clip.trackId,
          from: raw,
          durationInFrames: clip.durationInFrames,
          excludeClipId: clip.id,
        })
        setDraft({
          clipId,
          from: nextFrom,
          durationInFrames: clip.durationInFrames,
          trimStartFrames: clip.trim.startFrames,
        })
      },
      () => {
        if (nextFrom !== clip.from) {
          void onMutate({ type: 'place_clip', clipId, from: nextFrom }).finally(() =>
            setDraft(null),
          )
        } else {
          setDraft(null)
        }
      },
    )
  }

  const beginOverlayMove = (event: ReactPointerEvent<HTMLElement>, overlayId: string) => {
    if (busy) return
    const overlay = project.overlays.find((item) => item.id === overlayId)
    if (!overlay) return
    const overlayTrack = project.tracks.find(
      (track) => track.type === trackTypeForOverlayKind(overlay.kind),
    )
    if (overlayTrack?.locked) return
    selectOverlay(overlayId, event.shiftKey)
    let nextFrom = overlay.from
    bindPointerGesture(
      event,
      (delta) => {
        nextFrom = clampFrame(
          snapped(overlay.from + delta),
          0,
          Math.max(0, project.durationFrames - overlay.durationInFrames),
        )
        setOverlayDraft({
          overlayId,
          from: nextFrom,
          durationInFrames: overlay.durationInFrames,
        })
      },
      () => {
        if (nextFrom !== overlay.from) {
          void onMutate({ type: 'place_overlay', overlayId, from: nextFrom }).finally(() =>
            setOverlayDraft(null),
          )
        } else {
          setOverlayDraft(null)
        }
      },
    )
  }

  const beginOverlayTrim = (
    event: ReactPointerEvent<HTMLElement>,
    overlayId: string,
    edge: 'start' | 'end',
  ) => {
    if (busy) return
    const overlay = project.overlays.find((item) => item.id === overlayId)
    if (!overlay) return
    const overlayTrack = project.tracks.find(
      (track) => track.type === trackTypeForOverlayKind(overlay.kind),
    )
    if (overlayTrack?.locked) return
    selectOverlay(overlayId)
    let next: OverlayDraft = {
      overlayId,
      from: overlay.from,
      durationInFrames: overlay.durationInFrames,
    }
    bindPointerGesture(
      event,
      (delta) => {
        if (edge === 'start') {
          const boundedDelta = clampFrame(
            delta,
            -overlay.from,
            overlay.durationInFrames - MIN_OVERLAY_FRAMES,
          )
          next = {
            overlayId,
            from: overlay.from + boundedDelta,
            durationInFrames: overlay.durationInFrames - boundedDelta,
          }
        } else {
          next = {
            overlayId,
            from: overlay.from,
            durationInFrames: Math.max(MIN_OVERLAY_FRAMES, overlay.durationInFrames + delta),
          }
        }
        setOverlayDraft(next)
      },
      () => {
        if (next.from !== overlay.from || next.durationInFrames !== overlay.durationInFrames) {
          void onMutate({
            type: 'place_overlay',
            overlayId,
            from: next.from,
            durationInFrames: next.durationInFrames,
          }).finally(() => setOverlayDraft(null))
        } else {
          setOverlayDraft(null)
        }
      },
    )
  }

  const beginTrim = (
    event: ReactPointerEvent<HTMLElement>,
    clipId: string,
    edge: 'start' | 'end',
  ) => {
    if (busy) return
    const clip = project.clips.find((item) => item.id === clipId)
    if (!clip || trackLocked(clip.trackId)) return
    selectClip(clipId)
    let next: ClipDraft = {
      clipId,
      from: clip.from,
      durationInFrames: clip.durationInFrames,
      trimStartFrames: clip.trim.startFrames,
    }
    bindPointerGesture(
      event,
      (delta, clientX) => {
        if (edge === 'start') {
          const boundedDelta = clampFrame(
            delta,
            -Math.min(clip.from, clip.trim.startFrames),
            clip.durationInFrames - MIN_CLIP_FRAMES,
          )
          next = {
            clipId,
            from: clip.from + boundedDelta,
            durationInFrames: clip.durationInFrames - boundedDelta,
            trimStartFrames: clip.trim.startFrames + boundedDelta,
          }
        } else {
          const asset = assetById.get(clip.assetId)
          const naturalFrames =
            typeof asset?.probe?.durationFrames === 'number'
              ? asset.probe.durationFrames
              : Number.POSITIVE_INFINITY
          const maxDuration = Math.max(MIN_CLIP_FRAMES, naturalFrames - clip.trim.startFrames)
          const pointed = clampFrame(
            snapped(pointerFrame(clientX)),
            clip.from + MIN_CLIP_FRAMES,
            clip.from + maxDuration,
          )
          next = {
            clipId,
            from: clip.from,
            durationInFrames: Math.max(MIN_CLIP_FRAMES, pointed - clip.from),
            trimStartFrames: clip.trim.startFrames,
          }
        }
        setDraft(next)
      },
      () => {
        if (
          next.from !== clip.from ||
          next.durationInFrames !== clip.durationInFrames ||
          next.trimStartFrames !== clip.trim.startFrames
        ) {
          void onMutate({
            type: 'trim_clip',
            clipId,
            from: next.from,
            durationInFrames: next.durationInFrames,
            trimStartFrames: next.trimStartFrames,
          }).finally(() => setDraft(null))
        } else {
          setDraft(null)
        }
      },
    )
  }

  const splitSelection = () => {
    if (!primaryClip || !canSplit || busy) return
    void onMutate({ type: 'split_clip', clipId: primaryClip.id, atFrame: currentFrame })
  }

  const removeSelection = async (ripple = false) => {
    if (!hasSelection || busy) return
    const clipIds = [...selection.clips]
    const overlayIds = [...selection.overlays]
    setSelection(emptySelection())
    for (const clipId of clipIds) {
      await onMutate({
        type: ripple ? 'ripple_delete_clip' : 'remove_clip',
        clipId,
      })
    }
    for (const overlayId of overlayIds) {
      await onMutate({ type: 'remove_overlay', overlayId })
    }
  }

  const deleteClip = (clipId: string, ripple = false) => {
    if (busy) return
    setSelection(emptySelection())
    void onMutate({
      type: ripple ? 'ripple_delete_clip' : 'remove_clip',
      clipId,
    })
  }

  const deleteOverlay = (overlayId: string) => {
    if (busy) return
    setSelection(emptySelection())
    void onMutate({ type: 'remove_overlay', overlayId })
  }

  const nudgeSelection = (frames: number) => {
    if (busy) return
    for (const clip of selectedClips) {
      if (trackLocked(clip.trackId)) continue
      void onMutate({
        type: 'place_clip',
        clipId: clip.id,
        from: clampFrame(
          clip.from + frames,
          0,
          Math.max(0, project.durationFrames - clip.durationInFrames),
        ),
      })
    }
    for (const overlay of selectedOverlays) {
      void onMutate({
        type: 'place_overlay',
        overlayId: overlay.id,
        from: clampFrame(
          overlay.from + frames,
          0,
          Math.max(0, project.durationFrames - overlay.durationInFrames),
        ),
      })
    }
  }

  const toggleTrackFlag = (track: ProjectTrack, flag: 'locked' | 'hidden' | 'muted') => {
    if (busy) return
    void onMutate({
      type: 'set_track_flags',
      trackId: track.id,
      [flag]: !track[flag],
    })
  }

  const setCoverAtPlayhead = () => {
    if (busy) return
    void onMutate({ type: 'set_cover_frame', frame: currentFrame })
  }

  const requestVoiceover = () => {
    if (busy || !onRequestVoiceover) return
    const script = window.prompt('Voiceover script')
    if (!script?.trim()) return
    onRequestVoiceover(script.trim())
  }

  const renderClipBlock = (clip: ProjectClip, track: ProjectTrack) => {
    const visible = draft?.clipId === clip.id ? draft : clip
    const selected = selection.clips.includes(clip.id)
    const asset = assetById.get(clip.assetId)
    const isAudio = track.type === 'audio' || asset?.kind === 'audio'
    const width = Math.max(visible.durationInFrames * pixelsPerFrame, 12)
    const inSceneFocus = sceneFocusActive && focusClipIds!.has(clip.id)
    const sceneDimmed = sceneFocusActive && !focusClipIds!.has(clip.id)
    const mediaKind = asset?.kind
    const canPreview =
      (isAudio || mediaKind === 'video' || mediaKind === 'image') && Boolean(projectId)
    const contentUrl = canPreview ? assetContentUrl(projectId, clip.assetId) : null
    const posterFailed = failedFilmstrips.has(clip.id)
    const posterUrl = canPreview && !posterFailed ? assetPosterUrl(projectId, asset) : null
    const showFilmstrip =
      !isAudio && (mediaKind === 'video' || mediaKind === 'image') && contentUrl !== null
    const viewportStartFrame = scrollLeft / Math.max(0.01, pixelsPerFrame)
    const viewportEndFrame = (scrollLeft + laneWidthPx) / Math.max(0.01, pixelsPerFrame)
    const chrome = clipVisibleChrome({
      from: visible.from,
      durationInFrames: visible.durationInFrames,
      viewportStartFrame,
      viewportEndFrame,
      pixelsPerFrame,
    })

    return (
      <TimelineClipBlock
        key={clip.id}
        clip={clip}
        track={track}
        visible={visible}
        width={width}
        pixelsPerFrame={pixelsPerFrame}
        label={labelFor(clip.id)}
        selected={selected}
        dragging={draft?.clipId === clip.id}
        locked={Boolean(track.locked)}
        busy={busy}
        isAudio={isAudio}
        mediaKind={mediaKind}
        projectId={projectId}
        contentUrl={contentUrl}
        posterUrl={posterUrl}
        showFilmstrip={showFilmstrip}
        inSceneFocus={inSceneFocus}
        sceneDimmed={sceneDimmed}
        onFailedFilmstrip={() =>
          setFailedFilmstrips((current) => {
            if (current.has(clip.id)) return current
            const next = new Set(current)
            next.add(clip.id)
            return next
          })
        }
        onSelect={(additive) => selectClip(clip.id, additive)}
        onBeginMove={(event) => beginMove(event, clip.id)}
        onBeginTrim={(event, edge) => beginTrim(event, clip.id, edge)}
        onDelete={(ripple) => deleteClip(clip.id, ripple)}
        deleteLeftPx={chrome.deleteLeftPx}
        startHandleLeftPx={chrome.startHandleLeftPx}
        endHandleLeftPx={chrome.endHandleLeftPx}
      />
    )
  }

  return (
    <div
      className={`studio-timeline ${locked ? 'is-soft-locked' : ''}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        ) {
          return
        }
        if (event.key.toLowerCase() === 's') {
          event.preventDefault()
          splitSelection()
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault()
          if (locked || busy) return
          if (event.shiftKey) {
            if (canRedo) onRedo()
          } else if (canUndo) {
            onUndo()
          }
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
          event.preventDefault()
          if (canRedo && !busy && !locked) onRedo()
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault()
          if (!busy) void removeSelection(event.shiftKey)
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          nudgeSelection((event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 5 : 1))
        }
      }}
    >
      <div className="timeline-toolbar">
        <div className="timeline-toolbar-lead">
          <div className="timeline-toolbar-title">
            <strong>Edit</strong>
          </div>
          <div className="timeline-toolbar-group" role="toolbar" aria-label="Timeline edits">
            <button
              type="button"
              className="timeline-tool"
              disabled={busy || locked}
              title="Snap project length to the last clip/overlay (clears empty dead air)"
              onClick={() => void onMutate({ type: 'fit_duration' })}
            >
              <IconFitDuration />
              Fit
            </button>
            <button
              type="button"
              className="timeline-tool"
              disabled={!canUndo || busy || locked}
              title="Undo last edit (⌘Z / Ctrl+Z)"
              onClick={onUndo}
            >
              <IconUndo />
              Undo
              <kbd>Z</kbd>
            </button>
            <button
              type="button"
              className="timeline-tool"
              disabled={!canRedo || busy || locked}
              title="Redo (⌘⇧Z / Ctrl+Y)"
              onClick={onRedo}
            >
              <IconRedo />
              Redo
            </button>
            <span className="timeline-toolbar-sep" aria-hidden />
            <button
              type="button"
              className="timeline-tool"
              disabled={busy}
              title="Select clips and overlays left of the playhead"
              onClick={() => selectRelativeToPlayhead('left')}
            >
              <IconSelectLeft />
              Left
            </button>
            <button
              type="button"
              className="timeline-tool"
              disabled={busy}
              title="Select clips and overlays right of the playhead"
              onClick={() => selectRelativeToPlayhead('right')}
            >
              <IconSelectRight />
              Right
            </button>
            <button
              type="button"
              className="timeline-tool is-emphasized"
              disabled={!canSplit || busy}
              title={
                !primaryClip
                  ? 'Select a single clip first'
                  : !canSplit
                    ? 'Move the playhead inside the selected clip'
                    : 'Split clip at playhead'
              }
              onClick={splitSelection}
            >
              <IconScissors />
              Split
              <kbd>S</kbd>
            </button>
            <button
              type="button"
              className="timeline-tool is-danger"
              disabled={!hasSelection || busy}
              title={
                !hasSelection
                  ? 'Select a video, audio, or overlay first'
                  : locked
                    ? 'Delete (runs after the agent finishes this turn)'
                    : 'Delete selection (leaves a gap on the track)'
              }
              onClick={() => void removeSelection(false)}
            >
              <IconTrash />
              Delete
              <kbd>⌫</kbd>
            </button>
            <button
              type="button"
              className="timeline-tool is-danger"
              disabled={selectedClips.length === 0 || busy}
              title={
                selectedClips.length === 0
                  ? 'Select a video/audio clip first — ripple closes the gap (overlays just delete)'
                  : 'Delete clip(s) and pull later clips on that track left to close the gap'
              }
              onClick={() => void removeSelection(true)}
            >
              <IconRipple />
              Ripple
            </button>
          </div>
        </div>
        <div className="timeline-toolbar-meta">
          <span className="timeline-timecode tabular-nums" aria-live="polite">
            {formatTimecode(currentFrame)}
          </span>
          {project.coverFrame !== undefined ? (
            <span className="timeline-cover-chip tabular-nums" title="Cover frame">
              Cover {formatTimecode(project.coverFrame)}
            </span>
          ) : null}
          <label className="timeline-zoom">
            <span>zoom</span>
            <input
              type="range"
              min={ZOOM_FACTOR_MIN}
              max={ZOOM_FACTOR_MAX}
              step={0.05}
              value={zoomFactor}
              aria-label="Timeline zoom"
              aria-valuetext={
                isFitZoom ? 'Fit entire timeline' : `${zoomFactor.toFixed(1)}× into timeline`
              }
              onChange={(event) => setZoomFactor(Number(event.target.value))}
              onDoubleClick={applyFitZoom}
              title="Left = entire timeline · right = zoom into time · double-click to fit"
            />
          </label>
          {onCollapse ? (
            <PaneCollapseControl title="Minimize timeline" onClick={onCollapse}>
              <IconCollapsePanel />
            </PaneCollapseControl>
          ) : null}
        </div>
      </div>

      {locked ? (
        <div className="timeline-lock-banner" role="status">
          Agent is editing — your changes queue until this turn finishes.
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="timeline-scroll"
        style={{ ['--timeline-label-width' as string]: `${TRACK_LABEL_WIDTH}px` }}
        onDragOver={(event) => {
          if (busy) return
          const types = event.dataTransfer.types
          if (
            !types.includes('application/x-mos-asset-id') &&
            !types.includes(TEXT_PRESET_MIME) &&
            !types.includes(STICKER_PRESET_MIME)
          ) {
            return
          }
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setDropFrame(snapped(pointerFrame(event.clientX)))
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropFrame(null)
        }}
        onDrop={(event) => {
          event.preventDefault()
          const from = dropFrame ?? snapped(pointerFrame(event.clientX))
          setDropFrame(null)
          if (busy) return
          const stickerId = parseStickerDrag(event.dataTransfer.getData(STICKER_PRESET_MIME))
          if (stickerId) {
            onPlaceSticker?.(stickerId, from)
            return
          }
          const preset = parseTextPresetDrag(event.dataTransfer.getData(TEXT_PRESET_MIME))
          if (preset) {
            void onMutate({
              type: 'add_text',
              kind: preset.kind,
              text: preset.text,
              ...(preset.place === 'playhead'
                ? { from, durationInFrames: preset.durationInFrames }
                : {}),
            })
            return
          }
          const assetId = event.dataTransfer.getData('application/x-mos-asset-id')
          if (assetId) void onMutate({ type: 'add_clip', assetId, from })
        }}
      >
        <div
          className="timeline-canvas"
          style={{ width: canvasWidth }}
          onPointerDown={seekFromEmptyPointer}
        >
          <div
            className="timeline-ruler timeline-ruler-interactive"
            style={{ marginLeft: TRACK_LABEL_WIDTH, width: durationWidth }}
            onPointerDown={(event) => {
              if (!busy) onSeek(snapped(pointerFrame(event.clientX)))
            }}
          >
            {ticks.map(({ frame, major, label }) => (
              <span
                key={frame}
                className={`timeline-tick ${major ? 'is-major' : 'is-minor'}`}
                style={{ left: frame * pixelsPerFrame }}
              >
                <i />
                {label ? <em>{label}</em> : null}
              </span>
            ))}
          </div>

          {orderedTracks.map((track) => {
            if (track.hidden) {
              return (
                <div key={track.id} className="timeline-track is-hidden">
                  <TrackHeader
                    track={track}
                    busy={busy}
                    onToggleFlag={(flag) => toggleTrackFlag(track, flag)}
                    onCover={track.id === MAIN_VIDEO_TRACK_ID ? setCoverAtPlayhead : undefined}
                    onVoiceover={
                      track.type === 'audio' && track.id !== SFX_TRACK_ID
                        ? requestVoiceover
                        : undefined
                    }
                  />
                  <div className="track-lane is-collapsed" style={{ width: durationWidth }}>
                    <span className="track-empty">hidden</span>
                  </div>
                </div>
              )
            }

            if (track.type === 'overlay' || track.type === 'caption') {
              const laneOverlays = overlaysForTrack(project.overlays, track.type)
              const emptyLabel = track.type === 'caption' ? 'no captions yet' : 'no overlays yet'
              return (
                <div key={track.id} className="timeline-track">
                  <TrackHeader
                    track={track}
                    busy={busy}
                    onToggleFlag={(flag) => toggleTrackFlag(track, flag)}
                  />
                  <div
                    className={`track-lane track-lane-${track.type}`}
                    style={{ width: durationWidth }}
                    onDragOver={(event) => {
                      const types = event.dataTransfer.types
                      if (types.includes(TEXT_PRESET_MIME) || types.includes(STICKER_PRESET_MIME)) {
                        event.preventDefault()
                        event.stopPropagation()
                        if (busy || track.type !== 'overlay') {
                          event.dataTransfer.dropEffect = 'none'
                          return
                        }
                        event.dataTransfer.dropEffect = 'copy'
                        setDropFrame(snapped(pointerFrame(event.clientX)))
                        return
                      }
                      if (!types.includes('application/x-mos-asset-id')) return
                      event.preventDefault()
                      event.stopPropagation()
                      event.dataTransfer.dropEffect = 'none'
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const from = dropFrame ?? snapped(pointerFrame(event.clientX))
                      setDropFrame(null)
                      if (busy || track.type !== 'overlay') return
                      const stickerId = parseStickerDrag(
                        event.dataTransfer.getData(STICKER_PRESET_MIME),
                      )
                      if (stickerId) {
                        onPlaceSticker?.(stickerId, from)
                        return
                      }
                      const preset = parseTextPresetDrag(
                        event.dataTransfer.getData(TEXT_PRESET_MIME),
                      )
                      if (!preset) return
                      void onMutate({
                        type: 'add_text',
                        kind: preset.kind,
                        text: preset.text,
                        ...(preset.place === 'playhead'
                          ? { from, durationInFrames: preset.durationInFrames }
                          : {}),
                      })
                    }}
                  >
                    {laneOverlays.length === 0 ? (
                      <span className="track-empty">{emptyLabel}</span>
                    ) : (
                      laneOverlays.map((overlay) => {
                        const draftMatch =
                          overlayDraft?.overlayId === overlay.id ? overlayDraft : null
                        const visibleFrom = draftMatch?.from ?? overlay.from
                        const visibleDuration =
                          draftMatch?.durationInFrames ?? overlay.durationInFrames
                        const selected = selection.overlays.includes(overlay.id)
                        const trimLocked = Boolean(track.locked) || busy
                        return (
                          <div
                            key={overlay.id}
                            className={`clip-block clip-overlay ${selected ? 'is-selected' : ''} ${draftMatch ? 'is-dragging' : ''}`}
                            style={{
                              left: visibleFrom * pixelsPerFrame,
                              width: Math.max(visibleDuration * pixelsPerFrame, 12),
                              ['--overlay-color' as string]: overlayStyle[overlay.kind] ?? '#666',
                            }}
                            role="button"
                            tabIndex={0}
                            title={`${overlay.kind}: ${overlay.text} · ${formatTimecode(visibleFrom)} → ${formatTimecode(visibleFrom + visibleDuration)}`}
                            onPointerDown={(event) => beginOverlayMove(event, overlay.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                selectOverlay(overlay.id, event.shiftKey)
                              }
                            }}
                          >
                            {!trimLocked ? (
                              <span
                                className="clip-trim-handle is-start"
                                role="separator"
                                aria-label={`Resize start of ${overlay.kind}`}
                                onPointerDown={(event) =>
                                  beginOverlayTrim(event, overlay.id, 'start')
                                }
                              />
                            ) : null}
                            <span className="clip-block-name">
                              {overlay.kind.replace('_', ' ')}
                            </span>
                            <span className="clip-block-text">{overlay.text}</span>
                            {selected && !busy && !locked ? (
                              <button
                                type="button"
                                className="clip-block-delete"
                                title="Delete overlay (Del)"
                                aria-label={`Delete ${overlay.kind} overlay`}
                                onPointerDown={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                }}
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  deleteOverlay(overlay.id)
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                            {!trimLocked ? (
                              <span
                                className="clip-trim-handle is-end"
                                role="separator"
                                aria-label={`Resize end of ${overlay.kind}`}
                                onPointerDown={(event) =>
                                  beginOverlayTrim(event, overlay.id, 'end')
                                }
                              />
                            ) : null}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            }

            const laneClips = project.clips.filter((clip) => clip.trackId === track.id)
            const authoredCoverage =
              track.id === MAIN_VIDEO_TRACK_ID &&
              isAuthoredComposition(project.compositionId) &&
              project.compositionSource?.source
                ? authoredSequenceCoverage(project.compositionSource.source)
                : null
            const authoredSpan =
              authoredCoverage && authoredMotionSpanLayout(authoredCoverage, pixelsPerFrame)
            return (
              <div key={track.id} className={`timeline-track ${track.muted ? 'is-muted' : ''}`}>
                <TrackHeader
                  track={track}
                  busy={busy}
                  onToggleFlag={(flag) => toggleTrackFlag(track, flag)}
                  onCover={track.id === MAIN_VIDEO_TRACK_ID ? setCoverAtPlayhead : undefined}
                  onVoiceover={
                    track.type === 'audio' && track.id !== SFX_TRACK_ID
                      ? requestVoiceover
                      : undefined
                  }
                />
                <div
                  className={`track-lane track-lane-${track.type}`}
                  style={{ width: durationWidth }}
                  onDragOver={(event) => {
                    if (busy || !event.dataTransfer.types.includes('application/x-mos-asset-id')) {
                      return
                    }
                    event.preventDefault()
                    event.stopPropagation()
                    if (track.id === MAIN_VIDEO_TRACK_ID && authoredCoverage) {
                      event.dataTransfer.dropEffect = 'none'
                      return
                    }
                    event.dataTransfer.dropEffect = 'copy'
                    setDropFrame(snapped(pointerFrame(event.clientX)))
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (track.id === MAIN_VIDEO_TRACK_ID && authoredCoverage) return
                    const assetId = event.dataTransfer.getData('application/x-mos-asset-id')
                    const from = dropFrame ?? snapped(pointerFrame(event.clientX))
                    setDropFrame(null)
                    if (assetId && !busy) {
                      void onMutate({ type: 'add_clip', assetId, from, trackId: track.id })
                    }
                  }}
                >
                  {authoredSpan ? (
                    <button
                      type="button"
                      className="authored-motion-span"
                      style={{ left: authoredSpan.left, width: authoredSpan.width }}
                      aria-label="Motion ad"
                      title="Motion ad — click to seek. Extend by chatting, not by dropping a clip."
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        if (!busy) onSeek(snapped(pointerFrame(event.clientX)))
                      }}
                    >
                      Motion ad
                    </button>
                  ) : null}
                  {laneClips.length === 0 && !authoredSpan ? (
                    <span className="track-empty">
                      {track.id === BROLL_TRACK_ID
                        ? 'Drop overlay picture here'
                        : track.type === 'audio'
                          ? 'Drop audio or generate VO'
                          : 'Drag a video asset here'}
                    </span>
                  ) : (
                    laneClips.map((clip) => renderClipBlock(clip, track))
                  )}
                </div>
              </div>
            )
          })}

          <div
            className="timeline-playhead"
            style={{ left: TRACK_LABEL_WIDTH + currentFrame * pixelsPerFrame }}
            aria-hidden
          >
            <span className="timeline-playhead-grip" />
            <span className="timeline-playhead-needle" />
          </div>
          {project.coverFrame !== undefined ? (
            <div
              className="timeline-cover-marker"
              style={{ left: TRACK_LABEL_WIDTH + project.coverFrame * pixelsPerFrame }}
              title={`Cover ${formatTimecode(project.coverFrame)}`}
              aria-hidden
            />
          ) : null}
          {dropFrame !== null ? (
            <div
              className="timeline-drop-line"
              style={{ left: TRACK_LABEL_WIDTH + dropFrame * pixelsPerFrame }}
              aria-hidden
            />
          ) : null}
        </div>
      </div>

      {hasPipClips && pipLayout && onPipLayoutChange && onPipLayoutPreset ? (
        <PipLayoutInspector
          layout={pipLayout}
          disabled={busy || locked}
          onPreset={onPipLayoutPreset}
          onChange={onPipLayoutChange}
        />
      ) : null}

      {hasSelection && inspectorDismissed ? (
        <div className="timeline-status muted timeline-inspector-dismissed">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setInspectorDismissed(false)}
          >
            Show clip details
          </button>
          <span>{selection.clips.length + selection.overlays.length} selected · Del deletes</span>
        </div>
      ) : hasSelection ? (
        <div className={`timeline-inspector${inspectorMinimized ? ' is-minimized' : ''}`}>
          <div className="timeline-inspector-main">
            {selectedClips.length === 1 && primaryClip ? (
              <>
                <strong title={labelFor(primaryClip.id)}>{labelFor(primaryClip.id)}</strong>
                <span className="muted mono">
                  in {formatTimecode(primaryClip.from)} · out{' '}
                  {formatTimecode(primaryClip.from + primaryClip.durationInFrames)}
                </span>
                {!inspectorMinimized ? (
                  <label className="timeline-inspector-field">
                    <span>Duration</span>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      disabled={busy}
                      defaultValue={(primaryClip.durationInFrames / TIMELINE_FPS).toFixed(1)}
                      key={`${primaryClip.id}-${primaryClip.durationInFrames}`}
                      aria-label="Clip duration in seconds"
                      onBlur={(event) => {
                        const seconds = Number(event.target.value)
                        if (!Number.isFinite(seconds) || seconds <= 0) return
                        const durationInFrames = Math.max(
                          MIN_CLIP_FRAMES,
                          Math.round(seconds * TIMELINE_FPS),
                        )
                        if (durationInFrames === primaryClip.durationInFrames) return
                        void onMutate({
                          type: 'trim_clip',
                          clipId: primaryClip.id,
                          durationInFrames,
                        })
                      }}
                    />
                    <span className="muted">s</span>
                  </label>
                ) : null}
              </>
            ) : selectedOverlays.length === 1 && primaryOverlay ? (
              <>
                <strong>{primaryOverlay.kind.replace('_', ' ')}</strong>
                {inspectorMinimized ? (
                  <span className="muted mono">
                    in {formatTimecode(primaryOverlay.from)} · out{' '}
                    {formatTimecode(primaryOverlay.from + primaryOverlay.durationInFrames)}
                  </span>
                ) : primaryOverlay.kind === 'sticker' ? (
                  <p className="muted">Drag on the player to move and resize.</p>
                ) : (
                  <label className="timeline-inspector-field">
                    <span>Copy</span>
                    <input
                      type="text"
                      value={overlayCopy}
                      disabled={busy || locked}
                      aria-invalid={Boolean(overlayCopyError)}
                      onChange={(event) => {
                        setOverlayCopy(event.target.value)
                        setOverlayCopyError(null)
                      }}
                      onBlur={() => {
                        const text = overlayCopy.trim()
                        if (!text) {
                          setOverlayCopyError('Text cannot be empty')
                          setOverlayCopy(primaryOverlay.text)
                          return
                        }
                        if (text === primaryOverlay.text) return
                        void onMutate({
                          type: 'update_overlay',
                          overlayId: primaryOverlay.id,
                          text,
                        })
                      }}
                    />
                  </label>
                )}
                {!inspectorMinimized ? (
                  <>
                    {overlayCopyError ? (
                      <span className="timeline-inspector-error" role="alert">
                        {overlayCopyError}
                      </span>
                    ) : null}
                    <label className="timeline-inspector-field">
                      <span>Duration</span>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        disabled={busy}
                        defaultValue={(primaryOverlay.durationInFrames / TIMELINE_FPS).toFixed(1)}
                        key={`${primaryOverlay.id}-${primaryOverlay.durationInFrames}`}
                        onBlur={(event) => {
                          const seconds = Number(event.target.value)
                          if (!Number.isFinite(seconds) || seconds <= 0) return
                          const durationInFrames = Math.max(3, Math.round(seconds * TIMELINE_FPS))
                          if (durationInFrames === primaryOverlay.durationInFrames) return
                          void onMutate({
                            type: 'update_overlay',
                            overlayId: primaryOverlay.id,
                            durationInFrames,
                          })
                        }}
                      />
                      <span className="muted">s</span>
                    </label>
                    {primaryOverlay.kind === 'caption' &&
                    ((primaryOverlay.style?.emphasis?.length ?? 0) > 0 ||
                      (primaryOverlay.style?.emoji?.length ?? 0) > 0) ? (
                      <div
                        className="timeline-inspector-field timeline-caption-emphasis"
                        role="group"
                        aria-label="Caption highlights and marks"
                      >
                        <span>This caption</span>
                        {(primaryOverlay.style?.emphasis?.length ?? 0) > 0 ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy || locked}
                            onClick={() =>
                              void onMutate({
                                type: 'set_caption_style',
                                overlayId: primaryOverlay.id,
                                highlight: false,
                              })
                            }
                          >
                            Clear highlights
                          </button>
                        ) : null}
                        {(primaryOverlay.style?.emoji?.length ?? 0) > 0 ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy || locked}
                            onClick={() =>
                              void onMutate({
                                type: 'set_caption_style',
                                overlayId: primaryOverlay.id,
                                emoji: false,
                              })
                            }
                          >
                            Clear marks
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {primaryOverlay.kind !== 'sticker' && primaryOverlay.kind !== 'caption' ? (
                      <label className="timeline-inspector-field">
                        <span>Preset</span>
                        <select
                          disabled={busy || locked}
                          value={primaryOverlay.style?.presetId ?? ''}
                          onChange={(event) => {
                            const preset = getTextPreset(event.target.value)
                            if (!preset) return
                            void onMutate({
                              type: 'update_overlay',
                              overlayId: primaryOverlay.id,
                              layout: defaultOverlayLayout(preset.kind),
                              style: { ...primaryOverlay.style, presetId: preset.id },
                            })
                          }}
                        >
                          <option value="">Custom</option>
                          {TEXT_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <span className="muted mono">
                      in {formatTimecode(primaryOverlay.from)} · out{' '}
                      {formatTimecode(primaryOverlay.from + primaryOverlay.durationInFrames)}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <strong>{selection.clips.length + selection.overlays.length} items selected</strong>
            )}
          </div>
          <div className="timeline-inspector-actions">
            {selectedClips.length === 1 && onRequestSuggestions && !inspectorMinimized ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy || locked}
                onClick={onRequestSuggestions}
              >
                Suggestions
              </button>
            ) : null}
            <button
              type="button"
              className="timeline-inspector-icon"
              title={inspectorMinimized ? 'Expand clip details' : 'Minimize clip details'}
              aria-label={inspectorMinimized ? 'Expand clip details' : 'Minimize clip details'}
              onClick={() => setInspectorMinimized((current) => !current)}
            >
              <IconMinimize />
            </button>
            <button
              type="button"
              className="timeline-inspector-icon"
              title="Hide clip details"
              aria-label="Hide clip details"
              onClick={() => setInspectorDismissed(true)}
            >
              <IconX />
            </button>
            <span className="muted">
              Click to select · × or Del delete · ⇧Del / Ripple delete closes gaps · S split · ←/→
              nudge
            </span>
          </div>
        </div>
      ) : (
        <div className="timeline-status muted">
          {project.clips.length} clips · {project.overlays.length} overlays · {TIMELINE_FPS}fps
        </div>
      )}
    </div>
  )
}
