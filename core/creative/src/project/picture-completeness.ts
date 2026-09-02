import {
  isAuthoredComposition,
  isCampaignPackComposition,
  isSlideshowComposition,
  type ProjectAsset,
  type StudioProject,
} from './schema'
import { normalizePipLayout, type PipLayout } from './pip-layout'
import { BROLL_TRACK_ID, MAIN_VIDEO_TRACK_ID, mainVideoTrackId } from './tracks'

export const MAX_AD_SECONDS = 120
export const DEFAULT_AD_SECONDS = 30
/** Overlay smaller than this fraction of the frame is a stamp (ADR-0051). */
export const MIN_READABLE_OVERLAY_AREA = 0.2
/** Generated picture may overshoot the brief by this much before completeness fails. */
export const BRIEF_LENGTH_SLACK_SECONDS = 5
/** Short still end card after moving video (ADR-0051). Longer stills are padding. */
export const MAX_STILL_END_CARD_SECONDS = 3
export const maxStillEndCardFrames = (fps: number): number =>
  MAX_STILL_END_CARD_SECONDS * Math.max(1, Math.round(fps))

export type PictureCompletenessCode =
  | 'uncovered_main'
  | 'stills_only_main'
  | 'stills_padding_main'
  | 'overlay_without_main'
  | 'stamp_only_picture'
  | 'audio_over_black'
  | 'end_card_early'
  | 'cut_longer_than_brief'
  | 'missing_collection_look'
  | 'missing_music'
  | 'missing_brand'
  | 'uncovered_slideshow'
  | 'missing_slide_background'

export type PictureCompletenessFailure = {
  code: PictureCompletenessCode
  message: string
  uncoveredSeconds?: number[]
}

export type PictureCompletenessReport = {
  ok: boolean
  windowFrames: number
  failures: PictureCompletenessFailure[]
}

const VOICE_AUDIO_ROLES = new Set(['voice_studio', 'voice_dub', 'voiceover'])

export const isSpeechAudioAsset = (asset: StudioProject['assets'][number] | undefined): boolean => {
  if (!asset || asset.kind !== 'audio') return false
  if (asset.probe?.role === 'music_bed' || asset.probe?.role === 'sfx') return false
  if (typeof asset.probe?.role === 'string' && VOICE_AUDIO_ROLES.has(asset.probe.role)) return true
  return Boolean(asset.probe?.text || asset.probe?.voiceProvenance || asset.probe?.speechEnhanced)
}

export const projectHasMusicBed = (project: StudioProject): boolean => {
  const audioTrackIds = new Set(
    project.tracks.filter((track) => track.type === 'audio').map((track) => track.id),
  )
  return project.clips.some((clip) => {
    if (!audioTrackIds.has(clip.trackId)) return false
    const asset = project.assets.find((item) => item.id === clip.assetId)
    if (!asset || asset.kind !== 'audio') return false
    const role = asset.probe?.role
    if (role === 'music_bed') return true
    if (isSpeechAudioAsset(asset)) return false
    if (typeof role === 'string' && VOICE_AUDIO_ROLES.has(role)) return false
    return true
  })
}

/** True when spoken audio covers the picture start (frame 0), not a clip stacked after the bed. */
export const projectHasVoiceover = (project: StudioProject): boolean => {
  const audioTrackIds = new Set(
    project.tracks.filter((track) => track.type === 'audio').map((track) => track.id),
  )
  return project.clips.some((clip) => {
    if (!audioTrackIds.has(clip.trackId)) return false
    if (clip.from > 0) return false
    const asset = project.assets.find((item) => item.id === clip.assetId)
    return isSpeechAudioAsset(asset)
  })
}

/** Spoken clip exists but starts after frame 0 — inaudible during the picture. */
export const voiceoverStartsAfterPicture = (project: StudioProject): boolean => {
  const audioTrackIds = new Set(
    project.tracks.filter((track) => track.type === 'audio').map((track) => track.id),
  )
  const spoken = project.clips.filter((clip) => {
    if (!audioTrackIds.has(clip.trackId)) return false
    const asset = project.assets.find((item) => item.id === clip.assetId)
    return isSpeechAudioAsset(asset)
  })
  if (spoken.length === 0) return false
  return spoken.every((clip) => clip.from > 0)
}

const APPROVE_LOGO_MESSAGE =
  'Add a logo in Brand Studio before Approve. Colour or font alone is not enough.'

const hasBrandKit = (project: StudioProject): boolean => {
  const brand = project.brand
  if (!brand) return false
  return Boolean(brand.logoAssetId)
}

type Interval = { start: number; end: number }

const mergeIntervals = (raw: Interval[]): Interval[] => {
  const sorted = raw
    .filter((row) => row.end > row.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: Interval[] = []
  for (const row of sorted) {
    const last = merged[merged.length - 1]
    if (!last || row.start > last.end) {
      merged.push({ ...row })
      continue
    }
    last.end = Math.max(last.end, row.end)
  }
  return merged
}

const clipIntervals = (
  project: StudioProject,
  trackId: string,
  untilFrame: number,
  kinds?: ReadonlySet<ProjectAsset['kind']>,
): Interval[] =>
  mergeIntervals(
    project.clips
      .filter((clip) => clip.trackId === trackId)
      .filter((clip) => {
        if (!kinds) return true
        const asset = project.assets.find((item) => item.id === clip.assetId)
        return asset ? kinds.has(asset.kind) : false
      })
      .map((clip) => ({
        start: Math.max(0, clip.from),
        end: Math.min(untilFrame, clip.from + clip.durationInFrames),
      })),
  )

const gapsInWindow = (covered: Interval[], untilFrame: number): Interval[] => {
  const gaps: Interval[] = []
  let cursor = 0
  for (const row of covered) {
    if (row.start > cursor) gaps.push({ start: cursor, end: row.start })
    cursor = Math.max(cursor, row.end)
  }
  if (cursor < untilFrame) gaps.push({ start: cursor, end: untilFrame })
  return gaps
}

const secondsFromGaps = (gaps: Interval[], fps: number): number[] => {
  const seconds = new Set<number>()
  for (const gap of gaps) {
    const first = Math.floor(gap.start / fps)
    const last = Math.floor(Math.max(gap.start, gap.end - 1) / fps)
    for (let second = first; second <= last; second += 1) seconds.add(second)
  }
  return [...seconds].sort((a, b) => a - b)
}

const intervalFullyCovered = (covered: Interval[], start: number, end: number): boolean => {
  if (end <= start) return true
  let cursor = start
  for (const row of covered) {
    if (row.end <= cursor) continue
    if (row.start > cursor) return false
    cursor = Math.max(cursor, row.end)
    if (cursor >= end) return true
  }
  return cursor >= end
}

export const overlayLayoutIsReadable = (layout: PipLayout): boolean => {
  if (layout.mode === 'split') return true
  return layout.width * layout.height >= MIN_READABLE_OVERLAY_AREA
}

export const lastMainPictureEndFrames = (project: StudioProject): number => {
  const mainId = mainVideoTrackId(project.tracks)
  return project.clips
    .filter((clip) => clip.trackId === mainId)
    .reduce((end, clip) => Math.max(end, clip.from + clip.durationInFrames), 0)
}

export const lastMainVideoEndFrames = (project: StudioProject): number => {
  const mainId = mainVideoTrackId(project.tracks)
  return project.clips
    .filter((clip) => clip.trackId === mainId)
    .reduce((end, clip) => {
      const asset = project.assets.find((item) => item.id === clip.assetId)
      if (asset?.kind !== 'video') return end
      return Math.max(end, clip.from + clip.durationInFrames)
    }, 0)
}

/** Latest moving-picture asset on MAIN — the clip the next generate should continue (#646). */
export const lastMainVideoAssetId = (project: StudioProject): string | undefined => {
  const mainId = mainVideoTrackId(project.tracks)
  let best: { assetId: string; end: number } | undefined
  for (const clip of project.clips) {
    if (clip.trackId !== mainId) continue
    const asset = project.assets.find((item) => item.id === clip.assetId)
    if (asset?.kind !== 'video') continue
    const end = clip.from + clip.durationInFrames
    if (!best || end > best.end) best = { assetId: clip.assetId, end }
  }
  return best?.assetId
}

/** Seconds of the brief still uncovered by moving video. Null when the composition has no ad window. */
export const remainingBriefVideoSeconds = (project: StudioProject): number | null => {
  const windowFrames = pictureWindowFrames(project)
  if (windowFrames <= 0) return null
  const fps = Math.max(1, project.fps)
  return Math.max(0, (windowFrames - lastMainVideoEndFrames(project)) / fps)
}

export const assertMainStillFitsBrief = (
  project: StudioProject,
  input: {
    trackId: string
    from: number
    durationInFrames: number
    assetKind: ProjectAsset['kind']
  },
): void => {
  if (input.assetKind !== 'image') return
  if (
    isSlideshowComposition(project.compositionId) ||
    isCampaignPackComposition(project.compositionId) ||
    isAuthoredComposition(project.compositionId)
  ) {
    return
  }
  const mainId = mainVideoTrackId(project.tracks)
  if (input.trackId !== mainId) return
  const windowFrames = pictureWindowFrames(project)
  if (windowFrames <= 0) return
  const fps = Math.max(1, project.fps)
  const slackFrames = BRIEF_LENGTH_SLACK_SECONDS * fps
  const clipEnd = input.from + input.durationInFrames
  const lastVideoEnd = lastMainVideoEndFrames(project)
  if (lastVideoEnd > 0 && input.from >= lastVideoEnd) {
    if (input.durationInFrames > maxStillEndCardFrames(fps)) {
      throw new Error(
        'Do not pad the ad with still photos after moving video. A short still end card (about 3s) is enough. Generate more video or leave the cut at the requested length.',
      )
    }
  }
  if (clipEnd > windowFrames + slackFrames) {
    throw new Error(
      `Do not pad the ad past the requested ${Math.round(windowFrames / fps)}s. Trim or generate video that fits the brief.`,
    )
  }
}

export const pictureWindowFrames = (project: StudioProject): number => {
  if (
    isCampaignPackComposition(project.compositionId) ||
    isAuthoredComposition(project.compositionId)
  ) {
    return 0
  }
  if (isSlideshowComposition(project.compositionId)) {
    const slides = project.slideshow?.slides ?? []
    if (slides.length === 0) return 0
    return Math.max(
      1,
      slides.reduce((sum, slide) => sum + Math.max(1, slide.durationFrames), 0),
    )
  }
  const fps = Math.max(1, project.fps)
  const named = project.intent?.lengthSeconds
  const seconds = Math.min(
    MAX_AD_SECONDS,
    Math.max(1, named ?? Math.min(DEFAULT_AD_SECONDS, project.durationFrames / fps)),
  )
  // Intent length wins over a short empty canvas. add_clip grows durationFrames (ADR-0014).
  return Math.round(seconds * fps)
}

export const mainCoversWindow = (
  project: StudioProject,
  from: number,
  durationInFrames: number,
): boolean => {
  const mainId = mainVideoTrackId(project.tracks)
  const end = from + durationInFrames
  const until = Math.max(end, pictureWindowFrames(project))
  return intervalFullyCovered(clipIntervals(project, mainId, until), from, end)
}

export const resolvePictureTrackId = (
  project: StudioProject,
  preferred: string | undefined,
  from: number,
  durationInFrames: number,
): string => {
  const mainId = mainVideoTrackId(project.tracks)
  if (
    !preferred ||
    preferred === mainId ||
    preferred === 'main' ||
    preferred === MAIN_VIDEO_TRACK_ID
  ) {
    return mainId
  }
  if (preferred === BROLL_TRACK_ID || preferred === 'broll' || preferred === 'overlay') {
    return mainCoversWindow(project, from, durationInFrames) ? BROLL_TRACK_ID : mainId
  }
  return preferred
}

export const evaluatePictureCompleteness = (project: StudioProject): PictureCompletenessReport => {
  const windowFrames = pictureWindowFrames(project)
  if (windowFrames <= 0) {
    return { ok: true, windowFrames: 0, failures: [] }
  }

  if (isSlideshowComposition(project.compositionId)) {
    const failures: PictureCompletenessFailure[] = []
    if (!projectHasMusicBed(project)) {
      failures.push({
        code: 'missing_music',
        message:
          'This ad has no music bed. Generate music (confirm spend when £>0) or place a library track under the picture. Voiceover alone is not enough.',
      })
    }
    if (!hasBrandKit(project)) {
      failures.push({
        code: 'missing_brand',
        message: APPROVE_LOGO_MESSAGE,
      })
    }
    const slides = project.slideshow?.slides ?? []
    if (slides.some((slide) => !slide.backgroundAssetId)) {
      failures.push({
        code: 'missing_slide_background',
        message:
          'One or more slides have no background image. Generate a photographic or editorial background for every slide — brand-color rectangles plus type are not a finished ad.',
      })
    }
    if (project.durationFrames > windowFrames) {
      const fps = Math.max(1, project.fps)
      const extraSeconds = Math.round((project.durationFrames - windowFrames) / fps)
      failures.push({
        code: 'uncovered_slideshow',
        message: `The export canvas is ${extraSeconds}s longer than the slides, so the tail is empty. Fit duration to the slides or stretch/add slides until picture covers the cut.`,
      })
    }
    return { ok: failures.length === 0, windowFrames, failures }
  }

  const fps = Math.max(1, project.fps)
  const mainId = mainVideoTrackId(project.tracks)
  const mainCovered = clipIntervals(project, mainId, windowFrames)
  const mainGaps = gapsInWindow(mainCovered, windowFrames)
  const failures: PictureCompletenessFailure[] = []

  if (mainGaps.length > 0) {
    const uncoveredSeconds = secondsFromGaps(mainGaps, fps)
    failures.push({
      code: 'uncovered_main',
      message: `Main picture is missing on ${uncoveredSeconds.length} second(s) of the ${Math.round(windowFrames / fps)}s cut. Put generated picture full-frame on the main track.`,
      uncoveredSeconds,
    })
  }

  const mainVideoCovered = clipIntervals(project, mainId, windowFrames, new Set(['video']))
  if (mainGaps.length === 0 && mainCovered.length > 0 && mainVideoCovered.length === 0) {
    failures.push({
      code: 'stills_only_main',
      message:
        'The picture track is only still photos. Generate moving video for the full length. Do not tile the logo as the ad — logo belongs as overlay or a short end card.',
    })
  }

  const lastVideoEnd = lastMainVideoEndFrames(project)
  const lastMainEnd = lastMainPictureEndFrames(project)
  const stillPaddingFrames = lastVideoEnd > 0 ? lastMainEnd - lastVideoEnd : 0
  if (stillPaddingFrames > maxStillEndCardFrames(fps)) {
    failures.push({
      code: 'stills_padding_main',
      message:
        'Still photos after the video are padding the cut past the brief. Remove those stills or keep a short still end card (about 3s). Generate more video only if the requested length is not covered yet.',
    })
  }

  const overlayClips = project.clips.filter((clip) => clip.trackId === BROLL_TRACK_ID)
  const overlayWithoutMain = overlayClips.filter(
    (clip) => !mainCoversWindow(project, clip.from, clip.durationInFrames),
  )
  if (overlayWithoutMain.length > 0) {
    failures.push({
      code: 'overlay_without_main',
      message:
        'Overlay is only allowed on top of existing main picture. Move that picture to the main track, full-frame.',
    })
  }

  const layout = normalizePipLayout(project.pipLayout)
  const overlayIsOnlyPicture =
    overlayClips.length > 0 && mainCovered.length === 0 && !overlayLayoutIsReadable(layout)
  if (overlayIsOnlyPicture) {
    failures.push({
      code: 'stamp_only_picture',
      message:
        'The only picture is a small overlay on black. Put it full-frame on the main track, or use a readable split overlay on top of main picture.',
    })
  }

  const pictureEnd = mainCovered.reduce((end, row) => Math.max(end, row.end), 0)
  const audioEnd = project.clips
    .filter((clip) => {
      const track = project.tracks.find((item) => item.id === clip.trackId)
      return track?.type === 'audio'
    })
    .reduce((end, clip) => Math.max(end, clip.from + clip.durationInFrames), 0)

  if (audioEnd > pictureEnd) {
    failures.push({
      code: 'audio_over_black',
      message:
        'Music or voice plays past the last main picture. Shorten audio or fill the picture track.',
    })
  }

  const endCard = project.overlays.find((overlay) => overlay.kind === 'end_card')
  if (endCard && lastMainEnd > 0) {
    const cardEnd = endCard.from + endCard.durationInFrames
    if (endCard.from < lastMainEnd || cardEnd < lastMainEnd) {
      failures.push({
        code: 'end_card_early',
        message:
          'The end card finishes before the last main picture, so it appears mid-ad. Move it to the last seconds with place_overlay or set_end_card after the picture is in place.',
      })
    }
  }

  const slackFrames = BRIEF_LENGTH_SLACK_SECONDS * fps
  if (lastMainEnd > windowFrames + slackFrames) {
    failures.push({
      code: 'cut_longer_than_brief',
      message: `The picture track is ${Math.round(lastMainEnd / fps)}s but the brief asked for ${Math.round(windowFrames / fps)}s. Trim or pack to the requested length, then move the end card to the last seconds.`,
    })
  }

  if (!projectHasMusicBed(project)) {
    failures.push({
      code: 'missing_music',
      message:
        'This ad has no music bed. Generate music (confirm spend when £>0) or place a library track under the picture. Voiceover alone is not enough.',
    })
  }

  if (!hasBrandKit(project)) {
    failures.push({
      code: 'missing_brand',
      message: APPROVE_LOGO_MESSAGE,
    })
  }

  return { ok: failures.length === 0, windowFrames, failures }
}

export const formatPictureCompletenessError = (report: PictureCompletenessReport): string =>
  report.failures.map((failure) => failure.message).join(' ')

export const assertPictureCompleteness = (project: StudioProject, label = 'Cut'): void => {
  const report = evaluatePictureCompleteness(project)
  if (report.ok) return
  throw new Error(`${label} failed picture completeness. ${formatPictureCompletenessError(report)}`)
}
