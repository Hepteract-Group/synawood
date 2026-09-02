import { resolveCaptionPreset } from '../overlays/caption-styles'
import { getFirstPartySticker, stickerDataUrl } from '../overlays/stickers'
import type { StudioProject } from '../project/schema'
import { defaultOverlayLayout } from '../project/schema'
import { DEFAULT_PIP_LAYOUT, normalizePipLayout } from '../project/pip-layout'
import { BROLL_TRACK_ID } from '../project/tracks'
import { localeTextDirection } from '../locale/resolve'
import { type CubeLut } from '../library/cube'
import { type TalkingHeadClipProps, type TalkingHeadProps } from './talking-head-60'

export type AssetUrlResolver = (blobKey: string) => string

const toClipProps = (
  project: StudioProject,
  clip: StudioProject['clips'][number],
  resolveUrl: AssetUrlResolver,
  mutedTrackIds: Set<string>,
  cubeLuts?: Record<string, CubeLut>,
): TalkingHeadClipProps | null => {
  const asset = project.assets.find((item) => item.id === clip.assetId)
  if (!asset || (asset.kind !== 'video' && asset.kind !== 'image' && asset.kind !== 'audio')) {
    return null
  }
  const mediaKind =
    asset.kind === 'image'
      ? ('image' as const)
      : asset.kind === 'audio'
        ? ('audio' as const)
        : ('video' as const)
  return {
    src: resolveUrl(asset.blobKey),
    from: clip.from,
    durationInFrames: clip.durationInFrames,
    trimBefore: clip.trim.startFrames,
    mediaKind,
    muted: mutedTrackIds.has(clip.trackId),
    filterId: clip.filterId,
    filterIntensity: clip.filterIntensity,
    ...(clip.filterId && cubeLuts?.[clip.filterId] ? { cubeLut: cubeLuts[clip.filterId] } : {}),
    ...(clip.treatments?.length ? { treatments: clip.treatments } : {}),
    ...(clip.volumeEnvelope?.length ? { volumeEnvelope: clip.volumeEnvelope } : {}),
    ...(clip.reframe ? { reframe: clip.reframe } : {}),
  }
}

export const toTalkingHeadProps = (
  project: StudioProject,
  resolveUrl: AssetUrlResolver,
  options?: { cubeLuts?: Record<string, CubeLut>; trialWatermark?: boolean },
): TalkingHeadProps => {
  const hiddenTrackIds = new Set(
    project.tracks.filter((track) => track.hidden).map((track) => track.id),
  )
  const mutedTrackIds = new Set(
    project.tracks.filter((track) => track.muted).map((track) => track.id),
  )

  const visibleClips = project.clips.filter((clip) => !hiddenTrackIds.has(clip.trackId))

  const clips = visibleClips
    .filter((clip) => clip.trackId !== BROLL_TRACK_ID)
    .map((clip) => toClipProps(project, clip, resolveUrl, mutedTrackIds, options?.cubeLuts))
    .filter((clip): clip is TalkingHeadClipProps => clip != null)
    .sort((a, b) => a.from - b.from)

  const pipClips = visibleClips
    .filter((clip) => clip.trackId === BROLL_TRACK_ID)
    .map((clip) => toClipProps(project, clip, resolveUrl, mutedTrackIds, options?.cubeLuts))
    .filter((clip): clip is TalkingHeadClipProps => clip != null)
    .sort((a, b) => a.from - b.from)

  const hookTitle = project.overlays.find((overlay) => overlay.kind === 'hook_title')?.text
  const endCardOverlay = project.overlays.find((overlay) => overlay.kind === 'end_card')
  // Only fall back to brand defaultCta when the timeline is empty — otherwise a CTA
  // AbsoluteFill on the last 90 frames covers end-screen image clips (and any footage).
  const endCard =
    endCardOverlay?.text ??
    (project.clips.length === 0 ? project.brand?.defaultCta : undefined) ??
    undefined
  const captions = project.overlays
    .filter((overlay) => overlay.kind === 'caption')
    .map((overlay) => {
      const requested = overlay.style?.presetId
      const words = overlay.words
      return {
        text: overlay.text,
        from: overlay.from,
        durationInFrames: overlay.durationInFrames,
        presetId: resolveCaptionPreset(requested, words),
        words,
        emphasis: overlay.style?.emphasis?.map((item) => item.wordIndex),
        marks: overlay.style?.emoji?.flatMap((item) => {
          const sticker = getFirstPartySticker(item.stickerId)
          return sticker ? [{ wordIndex: item.wordIndex, src: stickerDataUrl(sticker) }] : []
        }),
      }
    })

  const textOverlays = project.overlays
    .filter(
      (overlay): overlay is typeof overlay & { kind: 'title' | 'lower_third' } =>
        overlay.kind === 'title' || overlay.kind === 'lower_third',
    )
    .map((overlay) => {
      const layout = overlay.layout ?? defaultOverlayLayout(overlay.kind)
      return {
        id: overlay.id,
        kind: overlay.kind,
        text: overlay.text,
        from: overlay.from,
        durationInFrames: overlay.durationInFrames,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        rotation: layout.rotation,
        align: overlay.style?.align,
        fill: overlay.style?.fill ?? project.brand?.primaryColor,
        fontSizeEm: overlay.style?.fontSizeEm,
      }
    })

  const stickers = project.overlays
    .filter((overlay) => overlay.kind === 'sticker' && overlay.assetId)
    .flatMap((overlay) => {
      const asset = project.assets.find((item) => item.id === overlay.assetId)
      if (!asset) return []
      const layout = overlay.layout ?? defaultOverlayLayout('sticker')
      return [
        {
          id: overlay.id,
          src: resolveUrl(asset.blobKey),
          from: overlay.from,
          durationInFrames: overlay.durationInFrames,
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
          rotation: layout.rotation,
        },
      ]
    })

  const logoAsset = project.brand?.logoAssetId
    ? project.assets.find((item) => item.id === project.brand?.logoAssetId)
    : undefined

  return {
    clips,
    pipClips,
    pipLayout: project.pipLayout ? normalizePipLayout(project.pipLayout) : DEFAULT_PIP_LAYOUT,
    stylePackId: project.stylePackId ?? null,
    hookTitle: hookTitle || undefined,
    endCard,
    endCardFrom: endCardOverlay?.from,
    endCardDurationInFrames: endCardOverlay?.durationInFrames ?? 90,
    captions,
    textOverlays,
    stickers,
    primaryColor: project.brand?.primaryColor,
    accentColor: project.brand?.accentColor,
    captionBg: project.brand?.captionBg,
    fontFamily: project.brand?.fontFamily,
    logoSrc: logoAsset ? resolveUrl(logoAsset.blobKey) : undefined,
    logoCorner: project.brand?.chrome?.corner,
    logoScale: project.brand?.chrome?.scale,
    logoSafeMargin: project.brand?.chrome?.safeMargin,
    brandLabel: project.brand?.displayName,
    disclaimer: project.governanceDisclaimer,
    textDirection: localeTextDirection(project.localization?.activeLocale ?? 'en'),
    trialWatermark: Boolean(options?.trialWatermark),
  }
}
