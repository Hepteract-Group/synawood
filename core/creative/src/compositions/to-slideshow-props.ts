import { getSlideshowPreset } from '../presets/slideshow'
import type { StudioProject } from '../project/schema'
import { localeTextDirection } from '../locale/resolve'
import type { AssetUrlResolver } from './to-talking-head-props'
import type { SlideshowCompositionProps, SlideshowSlideProps } from './slideshow'
import { totalSlideshowFrames } from './slideshow'

const FALLBACK_MARGINS = { top: 64, right: 64, bottom: 64, left: 64 }
const VOICE_AUDIO_ROLES = new Set(['voice_studio', 'voice_dub'])

const musicBedClip = (project: StudioProject) => {
  const audioTrackIds = new Set(
    project.tracks.filter((track) => track.type === 'audio').map((track) => track.id),
  )
  return project.clips.find((item) => {
    if (!audioTrackIds.has(item.trackId)) return false
    const asset = project.assets.find((row) => row.id === item.assetId)
    if (!asset || asset.kind !== 'audio') return false
    const role = asset.probe?.role
    if (typeof role === 'string' && VOICE_AUDIO_ROLES.has(role)) return false
    return true
  })
}

export const toSlideshowProps = (
  project: StudioProject,
  resolveUrl: AssetUrlResolver,
  options?: { trialWatermark?: boolean },
): SlideshowCompositionProps & { durationInFrames: number } => {
  const extras = project.slideshow
  const preset = extras ? getSlideshowPreset(extras.presetId) : null
  const safeMargins = preset?.safeMargins ?? FALLBACK_MARGINS

  const slides: SlideshowSlideProps[] = (extras?.slides ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((slide) => {
      const bg = slide.backgroundAssetId
        ? project.assets.find((asset) => asset.id === slide.backgroundAssetId)
        : undefined
      return {
        headline: slide.headline,
        body: slide.body,
        layout: slide.layout,
        backgroundSrc: bg ? resolveUrl(bg.blobKey) : undefined,
        durationInFrames: slide.durationFrames,
        transition: slide.transition,
      }
    })

  const voiceoverAsset = extras?.voiceoverAssetId
    ? project.assets.find((asset) => asset.id === extras.voiceoverAssetId)
    : undefined
  const voiceoverTrackMuted = project.tracks.some((track) => track.type === 'audio' && track.muted)
  const musicClip = musicBedClip(project)
  const musicAsset = musicClip
    ? project.assets.find((asset) => asset.id === musicClip.assetId)
    : undefined
  const musicTrackMuted = Boolean(
    musicClip && project.tracks.find((track) => track.id === musicClip.trackId)?.muted,
  )

  const logoAsset = project.brand?.logoAssetId
    ? project.assets.find((item) => item.id === project.brand?.logoAssetId)
    : undefined

  return {
    slides,
    voiceoverSrc: voiceoverAsset ? resolveUrl(voiceoverAsset.blobKey) : undefined,
    voiceoverMuted: voiceoverTrackMuted,
    musicSrc: musicAsset ? resolveUrl(musicAsset.blobKey) : undefined,
    musicMuted: musicTrackMuted,
    stylePackId: project.stylePackId ?? null,
    primaryColor: project.brand?.primaryColor,
    accentColor: project.brand?.accentColor,
    fontFamily: project.brand?.fontFamily,
    backgroundColor: project.brand?.primaryColor ? undefined : '#0f1410',
    defaultCta: project.brand?.defaultCta,
    logoSrc: logoAsset ? resolveUrl(logoAsset.blobKey) : undefined,
    logoCorner: project.brand?.chrome?.corner,
    logoScale: project.brand?.chrome?.scale,
    safeMargins,
    durationInFrames: Math.max(1, totalSlideshowFrames(slides)),
    disclaimer: project.governanceDisclaimer,
    textDirection: localeTextDirection(project.localization?.activeLocale ?? 'en'),
    trialWatermark: Boolean(options?.trialWatermark),
  }
}
