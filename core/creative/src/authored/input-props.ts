import type { ProofStat, StudioProject } from '../project/schema'
import type { AssetUrlResolver } from '../compositions/to-talking-head-props'
import { bindInventedStillProps, toAuthoredPlates } from './bind-authored-stills'
import { bindMotionMediaProps } from './bind-motion-media'

export type AuthoredAudioClipProps = {
  src: string
  from: number
  durationInFrames: number
  trimBefore?: number
  muted?: boolean
}

export type AuthoredInputProps = {
  motionSeed: string
  primaryColor?: string
  accentColor?: string
  fontFamily?: string
  brandLabel?: string
  logoSrc?: string
  disclaimer?: string
  trialWatermark?: boolean
  plates: string[]
  heroSrc?: string
  /** Alias of logoSrc — agents bind `logoUrl`. */
  logoUrl?: string
  /** Alias of heroSrc — agents bind `productUrl`. */
  productUrl?: string
  proofStat?: ProofStat
  audioClips: AuthoredAudioClipProps[]
  /** Precomputed music energy 0–1 per frame. Captions punch on peaks only. */
  audioEnergy?: number[]
}

const timelineAudioClips = (
  project: StudioProject,
  resolveUrl: AssetUrlResolver,
): AuthoredAudioClipProps[] => {
  const hiddenTrackIds = new Set(
    project.tracks.filter((track) => track.hidden).map((track) => track.id),
  )
  const mutedTrackIds = new Set(
    project.tracks.filter((track) => track.muted).map((track) => track.id),
  )

  return project.clips.flatMap((clip) => {
    if (hiddenTrackIds.has(clip.trackId)) return []
    const asset = project.assets.find((item) => item.id === clip.assetId)
    if (!asset || asset.kind !== 'audio') return []
    const src = resolveUrl(asset.blobKey)
    if (!src) return []
    return [
      {
        src,
        from: clip.from,
        durationInFrames: clip.durationInFrames,
        trimBefore: clip.trim.startFrames,
        muted: mutedTrackIds.has(clip.trackId),
      },
    ]
  })
}

export const parseAuthoredAudioClips = (
  inputProps: Record<string, unknown>,
): AuthoredAudioClipProps[] => {
  const raw = inputProps.audioClips
  if (!Array.isArray(raw)) return []
  return raw.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const clip = row as Record<string, unknown>
    if (typeof clip.src !== 'string' || clip.src.length === 0) return []
    if (typeof clip.from !== 'number' || typeof clip.durationInFrames !== 'number') return []
    return [
      {
        src: clip.src,
        from: clip.from,
        durationInFrames: clip.durationInFrames,
        ...(typeof clip.trimBefore === 'number' ? { trimBefore: clip.trimBefore } : {}),
        ...(clip.muted === true ? { muted: true } : {}),
      },
    ]
  })
}

export type AuthoredAudioClockRow = {
  src: string
  currentTime: number
  active: boolean
}

/** Parent-origin <audio> clock — unique-origin iframe cannot use cookie’d content URLs. */
export const authoredAudioClock = (input: {
  clips: AuthoredAudioClipProps[]
  fps: number
  frame: number
}): AuthoredAudioClockRow[] => {
  const fps = Math.max(1, input.fps)
  return input.clips.map((clip) => {
    const localFrame = input.frame - clip.from
    const active = localFrame >= 0 && localFrame < clip.durationInFrames && clip.muted !== true
    return {
      src: clip.src,
      currentTime: Math.max(0, (localFrame + (clip.trimBefore ?? 0)) / fps),
      active,
    }
  })
}

const plateUrls = (plates: unknown): string[] =>
  Array.isArray(plates)
    ? plates.flatMap((row) => {
        if (typeof row === 'string' && row.length > 0) return [row]
        if (row && typeof row === 'object' && 'src' in row && typeof row.src === 'string') {
          return [row.src]
        }
        return []
      })
    : []

const cloneableRecord = (value: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>

/** Parent postMessage payload — no functions (structured clone). */
export const authoredIframeInputProps = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const urls = plateUrls(props.plates)
  return cloneableRecord({
    ...props,
    audioClips: [],
    ...(urls.length > 0 ? { plates: urls.map((src) => ({ src })) } : {}),
  })
}

/** Iframe-side Remotion props — restore plate toString after clone. */
export const hydrateAuthoredInputProps = (
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const cloneable = authoredIframeInputProps(props)
  const urls = plateUrls(cloneable.plates)
  return {
    ...cloneable,
    ...(urls.length > 0 ? { plates: toAuthoredPlates(urls) } : {}),
  }
}

export const toAuthoredInputProps = (
  project: StudioProject,
  resolveUrl: AssetUrlResolver,
  options?: { trialWatermark?: boolean },
): AuthoredInputProps => {
  const bound = bindMotionMediaProps({ project, resolveUrl })
  const invented = bindInventedStillProps(project.compositionSource?.source ?? '', {
    logo: bound.logoSrc,
    hero: bound.heroSrc,
    plates: bound.plates,
  })

  return {
    motionSeed: project.compositionSource?.motionSeed ?? project.id,
    primaryColor: project.brand?.primaryColor,
    accentColor: project.brand?.accentColor,
    fontFamily: project.brand?.fontFamily,
    brandLabel: project.brand?.displayName,
    logoSrc: bound.logoSrc,
    logoUrl: bound.logoSrc,
    disclaimer: project.governanceDisclaimer,
    trialWatermark: Boolean(options?.trialWatermark),
    plates: bound.plates,
    heroSrc: bound.heroSrc,
    productUrl: bound.heroSrc,
    // Kit CountUp binds one host prop; extra catalog stats stay on brand until a multi-stat layout exists.
    ...(project.brand?.proofStats?.[0] ? { proofStat: project.brand.proofStats[0] } : {}),
    audioClips: timelineAudioClips(project, resolveUrl),
    ...invented,
  }
}
