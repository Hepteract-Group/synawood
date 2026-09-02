'use client'

import { Player, type PlayerRef } from '@remotion/player'
import {
  SocialCarousel,
  TalkingHead60,
  VerticalSlideshow,
  socialCarouselMeta,
  talkingHeadMeta,
  toSlideshowProps,
  toTalkingHeadProps,
  verticalSlideshowMeta,
} from '@synawood/creative/compositions'
import type { PipLayout, StudioProject } from '@synawood/creative/project/client'
import { isAuthoredComposition } from '@synawood/creative/project/client'
import { isCubeLut, type CubeLut } from '@synawood/creative/library'
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react'
import { AuthoredPlayerPane } from './AuthoredPlayerPane'

type PlayerProject = StudioProject & {
  assets: Array<StudioProject['assets'][number] & { signedUrl?: string }>
}

type PlayerPaneProps = {
  project: PlayerProject
  playerRef: RefObject<PlayerRef | null>
  previewZoom: number
  onFrameUpdate: (frame: number) => void
  onPlayingChange: (isPlaying: boolean) => void
  pipLayoutOverride?: PipLayout | null
  overlay?: ReactNode
  /** Hosted trial — match export burn-in (#1044). */
  trialWatermark?: boolean
}

/** Browser-safe — import `@synawood/creative/project/client`, not the Node project barrel. */
const isSlideshowCompositionId = (id: string): boolean =>
  id === 'social-carousel' || id === 'vertical-slideshow'

export const PlayerPane = ({
  project,
  playerRef,
  previewZoom,
  onFrameUpdate,
  onPlayingChange,
  pipLayoutOverride,
  overlay,
  trialWatermark = false,
}: PlayerPaneProps) => {
  const urlByBlobKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const asset of project.assets) {
      map.set(asset.blobKey, `/api/studio/projects/${project.id}/assets/${asset.id}/content`)
    }
    return map
  }, [project])

  const [cubeLuts, setCubeLuts] = useState<Record<string, CubeLut>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const response = await fetch(`/api/studio/projects/${project.id}/library?kind=filter`, {
        credentials: 'same-origin',
      })
      if (!response.ok) return
      const body = (await response.json().catch(() => null)) as {
        items?: Array<{ id: string; recipe: unknown }>
      } | null
      const next: Record<string, CubeLut> = {}
      for (const item of body?.items ?? []) {
        if (isCubeLut(item.recipe)) next[item.id] = item.recipe
      }
      if (!cancelled) setCubeLuts(next)
    })()
    return () => {
      cancelled = true
    }
  }, [project.id, project.revision])

  const resolveUrl = (blobKey: string) => urlByBlobKey.get(blobKey) ?? ''

  const slideshow = isSlideshowCompositionId(project.compositionId)
  const talkingHeadProps = useMemo(() => {
    const mapped = toTalkingHeadProps(project, resolveUrl, { cubeLuts, trialWatermark })
    return pipLayoutOverride ? { ...mapped, pipLayout: pipLayoutOverride } : mapped
  }, [project, urlByBlobKey, pipLayoutOverride, cubeLuts, trialWatermark])
  const slideshowMapped = useMemo(
    () => toSlideshowProps(project, resolveUrl, { trialWatermark }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, urlByBlobKey, trialWatermark],
  )

  // Keep a stable inputProps reference. Destructuring `{ duration, ...rest }` every
  // render creates a new object → Remotion rebuilds the player context and snaps to
  // frame 0, which undoes slide-strip seeks until the user hits Play.
  const slideshowProps = useMemo(() => {
    const { durationInFrames: _duration, ...props } = slideshowMapped
    return props
  }, [slideshowMapped])
  const slideshowDuration = slideshowMapped.durationInFrames

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    const readFrame = (event: { detail?: { frame?: number } }) => {
      const frame = event.detail?.frame
      if (typeof frame === 'number' && Number.isFinite(frame)) onFrameUpdate(frame)
    }
    const onFrame = readFrame
    const onSeeked = readFrame
    const onPlay = () => onPlayingChange(true)
    const onPause = () => onPlayingChange(false)
    player.addEventListener('frameupdate', onFrame)
    player.addEventListener('timeupdate', onFrame)
    player.addEventListener('seeked', onSeeked)
    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
    player.addEventListener('ended', onPause)
    return () => {
      player.removeEventListener('frameupdate', onFrame)
      player.removeEventListener('timeupdate', onFrame)
      player.removeEventListener('seeked', onSeeked)
      player.removeEventListener('play', onPlay)
      player.removeEventListener('pause', onPause)
      player.removeEventListener('ended', onPause)
    }
  }, [onFrameUpdate, onPlayingChange, playerRef])

  const meta = slideshow
    ? project.compositionId === 'vertical-slideshow'
      ? verticalSlideshowMeta
      : socialCarouselMeta
    : talkingHeadMeta

  const compositionWidth = project.width || meta.width
  const compositionHeight = project.height || meta.height
  const durationInFrames = slideshow
    ? Math.max(project.durationFrames, slideshowDuration)
    : project.durationFrames

  if (isAuthoredComposition(project.compositionId)) {
    return (
      <AuthoredPlayerPane
        project={project}
        playerRef={playerRef}
        previewZoom={previewZoom}
        onFrameUpdate={onFrameUpdate}
        onPlayingChange={onPlayingChange}
      />
    )
  }

  return (
    <div className="player-shell player-shell-compact">
      <div
        className="player-frame"
        style={{
          ['--player-ar-w' as string]: compositionWidth,
          ['--player-ar-h' as string]: compositionHeight,
          maxHeight: `${previewZoom * 100}%`,
        }}
      >
        {slideshow ? (
          <Player
            ref={playerRef}
            component={
              project.compositionId === 'vertical-slideshow' ? VerticalSlideshow : SocialCarousel
            }
            inputProps={slideshowProps}
            durationInFrames={durationInFrames}
            compositionWidth={compositionWidth}
            compositionHeight={compositionHeight}
            fps={project.fps || meta.fps}
            style={{ width: '100%', height: '100%' }}
            controls={false}
            spaceKeyToPlayOrPause={false}
          />
        ) : (
          <Player
            ref={playerRef}
            component={TalkingHead60}
            inputProps={talkingHeadProps}
            durationInFrames={durationInFrames}
            compositionWidth={talkingHeadMeta.width}
            compositionHeight={talkingHeadMeta.height}
            fps={talkingHeadMeta.fps}
            style={{ width: '100%', height: '100%' }}
            controls={false}
            spaceKeyToPlayOrPause={false}
            // Video clips emit audio too — shared tags must cover picture + beds.
            numberOfSharedAudioTags={Math.max(
              5,
              talkingHeadProps.clips.length + (talkingHeadProps.pipClips?.length ?? 0),
            )}
          />
        )}
        {overlay}
      </div>
    </div>
  )
}
