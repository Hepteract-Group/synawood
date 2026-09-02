import { randomUUID } from 'node:crypto'
import type {
  OverlayKind,
  OverlayLayout,
  OverlayStyle,
  ProjectAsset,
  ProjectClip,
  StudioProject,
} from './schema'
import {
  defaultOverlayLayout,
  isAuthoredComposition,
  isSingletonOverlayKind,
  isSlideshowComposition,
  studioProjectSchema,
} from './schema'
import { getFirstPartySticker } from '../overlays/stickers'
import { authoredSequenceCoverage } from '../authored/sequence-coverage'
import { resolveMagneticClipFrom } from './clip-placement'
import {
  assertMainStillFitsBrief,
  lastMainPictureEndFrames,
  lastMainVideoEndFrames,
  pictureWindowFrames,
  resolvePictureTrackId,
} from './picture-completeness'
import { BROLL_TRACK_ID, MAIN_VIDEO_TRACK_ID, SFX_TRACK_ID, mainVideoTrackId } from './tracks'

export { resolveMagneticClipFrom } from './clip-placement'

const nextRevision = (project: StudioProject): number => project.revision + 1

/**
 * Reject overlapping placement on the same track before it lands. Silent
 * overlaps corrupt the timeline (duplicate visible content, thrash-y
 * recovery by the agent) and previously had no guard beyond a prompt hint.
 */
const assertNoOverlap = (
  project: StudioProject,
  input: { trackId: string; from: number; durationInFrames: number; excludeClipId?: string },
): void => {
  const to = input.from + input.durationInFrames
  const collision = project.clips.find(
    (clip) =>
      clip.id !== input.excludeClipId &&
      clip.trackId === input.trackId &&
      clip.from < to &&
      clip.from + clip.durationInFrames > input.from,
  )
  if (collision) {
    throw new Error(
      `Clip would overlap existing clip ${collision.id} on ${input.trackId} ` +
        `(new ${input.from}-${to}, existing ${collision.from}-${collision.from + collision.durationInFrames}). ` +
        `Choose a non-overlapping "from", or trim/move/remove the existing clip first.`,
    )
  }
}

/** End of the last placed content (clips + overlays), in frames. */
export const lastContentEndFrames = (project: StudioProject): number => {
  const clipEnd = project.clips.reduce(
    (end, clip) => Math.max(end, clip.from + clip.durationInFrames),
    0,
  )
  const overlayEnd = project.overlays.reduce(
    (end, overlay) => Math.max(end, overlay.from + overlay.durationInFrames),
    0,
  )
  return Math.max(clipEnd, overlayEnd)
}

export const END_CARD_GAP_FRAMES = 15

const MIN_DURATION_FRAMES = 90
const AUTO_FIT_PADDING_FRAMES = 45

/** If the end card sits in the middle of MAIN, pin it after the last picture. */
export const reanchorEarlyEndCard = (project: StudioProject): StudioProject => {
  const card = project.overlays.find((overlay) => overlay.kind === 'end_card')
  if (!card) return project
  const pictureEnd = lastMainPictureEndFrames(project)
  if (pictureEnd <= 0) return project
  if (card.from >= pictureEnd) return project
  const from = pictureEnd + END_CARD_GAP_FRAMES
  if (from === card.from) return project
  return {
    ...project,
    overlays: project.overlays.map((overlay) =>
      overlay.id === card.id ? { ...overlay, from } : overlay,
    ),
  }
}

/**
 * ADR-0014: durationFrames is project-owned and tracks content.
 * Sets duration to last content end + a small tail (grow or shrink).
 * Empty timeline collapses to MIN_DURATION_FRAMES so deletes don't leave hour-long dead air.
 */
export const autoFitDuration = (project: StudioProject): StudioProject => {
  const anchored = reanchorEarlyEndCard(project)
  if (isAuthoredComposition(anchored.compositionId)) {
    const coverage = authoredSequenceCoverage(anchored.compositionSource?.source ?? '')
    const intentFrames =
      typeof anchored.intent?.lengthSeconds === 'number' && anchored.intent.lengthSeconds > 0
        ? Math.round(anchored.intent.lengthSeconds * Math.max(1, anchored.fps))
        : 0
    const pictureEnd = coverage?.end ?? 0
    const needed = Math.max(pictureEnd, intentFrames, MIN_DURATION_FRAMES)
    if (anchored.durationFrames === needed && anchored.overlays === project.overlays) {
      return project
    }
    return studioProjectSchema.parse({ ...anchored, durationFrames: needed })
  }
  const slideshowEnd = isSlideshowComposition(anchored.compositionId)
    ? pictureWindowFrames(anchored)
    : null
  const contentEnd = slideshowEnd ?? lastContentEndFrames(anchored)
  const needed =
    slideshowEnd !== null
      ? Math.max(slideshowEnd === 0 ? MIN_DURATION_FRAMES : slideshowEnd, MIN_DURATION_FRAMES)
      : Math.max(
          contentEnd === 0 ? MIN_DURATION_FRAMES : contentEnd + AUTO_FIT_PADDING_FRAMES,
          MIN_DURATION_FRAMES,
        )
  if (anchored.durationFrames === needed && anchored.overlays === project.overlays) {
    return project
  }
  return studioProjectSchema.parse({ ...anchored, durationFrames: needed })
}

/**
 * Map agent aliases ("video", "track_video", "broll") onto a real project track id.
 */
export const resolveTrackId = (project: StudioProject, trackId?: string): string => {
  const preferred = trackId?.trim()
  if (!preferred) {
    return mainVideoTrackId(project.tracks)
  }
  if (project.tracks.some((track) => track.id === preferred)) {
    return preferred
  }
  const alias = preferred.toLowerCase().replaceAll('_', '-')
  if (alias === 'broll' || alias === 'b-roll' || alias === 'pip' || alias === 'track-broll') {
    const broll = project.tracks.find((track) => track.id === BROLL_TRACK_ID)
    if (broll) return broll.id
  }
  if (alias === 'sfx' || alias === 'sounds' || alias === 'track-sfx') {
    const sfx = project.tracks.find((track) => track.id === SFX_TRACK_ID)
    if (sfx) return sfx.id
  }
  if (preferred === 'video' || preferred === 'video_track' || preferred === 'main') {
    return mainVideoTrackId(project.tracks)
  }
  throw new Error(
    `Unknown track: ${preferred}. Use a project track id (e.g. ${MAIN_VIDEO_TRACK_ID} or ${BROLL_TRACK_ID}) or omit trackId.`,
  )
}

/** True when sorted clips on the track leave an empty gap between neighbors. */
export const videoTrackHasGaps = (project: StudioProject, trackId?: string): boolean => {
  const resolved = resolveTrackId(project, trackId)
  const onTrack = project.clips
    .filter((clip) => clip.trackId === resolved)
    .slice()
    .sort((a, b) => a.from - b.from || a.id.localeCompare(b.id))
  for (let i = 1; i < onTrack.length; i += 1) {
    const prev = onTrack[i - 1]!
    const next = onTrack[i]!
    if (next.from > prev.from + prev.durationInFrames) return true
  }
  return false
}

/** Snap duration to content end + padding (explicit Fit to content). Bumps revision. */
export const fitDurationToContent = (project: StudioProject): StudioProject => {
  const slideshowEnd = isSlideshowComposition(project.compositionId)
    ? pictureWindowFrames(project)
    : null
  const contentEnd = slideshowEnd ?? lastContentEndFrames(project)
  const durationFrames =
    slideshowEnd !== null
      ? Math.max(slideshowEnd === 0 ? MIN_DURATION_FRAMES : slideshowEnd, MIN_DURATION_FRAMES)
      : Math.max(
          contentEnd === 0 ? MIN_DURATION_FRAMES : contentEnd + AUTO_FIT_PADDING_FRAMES,
          MIN_DURATION_FRAMES,
        )
  if (durationFrames === project.durationFrames) {
    if (videoTrackHasGaps(project)) {
      throw new Error(
        'Duration already fits content (including overlays), but video clips have gaps. ' +
          'Call pack_clips to close gaps between clips — fit_duration only trims trailing dead air.',
      )
    }
    throw new Error(
      'fit_duration made no change — duration already matches content end. ' +
        'If clips look sparse, call pack_clips; if you need a longer canvas, use set_duration.',
    )
  }
  return studioProjectSchema.parse({
    ...project,
    durationFrames,
    revision: nextRevision(project),
  })
}

/**
 * Explicitly set project duration. Never shrinks below placed content; never
 * below a minimal sensible length. The ≤60s channel ceiling is a Final-asset
 * validation concern, not a floor here.
 */
export const setDuration = (project: StudioProject, durationFrames: number): StudioProject => {
  const floor = isSlideshowComposition(project.compositionId)
    ? Math.max(pictureWindowFrames(project), MIN_DURATION_FRAMES)
    : Math.max(lastContentEndFrames(project), MIN_DURATION_FRAMES)
  const next = Math.max(durationFrames, floor)
  return studioProjectSchema.parse({
    ...project,
    durationFrames: next,
    revision: nextRevision(project),
  })
}

export const attachAsset = (project: StudioProject, asset: ProjectAsset): StudioProject => {
  if (project.assets.some((item) => item.id === asset.id)) {
    throw new Error(`Asset ${asset.id} is already on the project`)
  }
  return studioProjectSchema.parse({
    ...project,
    assets: [...project.assets, asset],
    revision: nextRevision(project),
  })
}

export const retargetClipAsset = (
  project: StudioProject,
  clipId: string,
  assetId: string,
): StudioProject => {
  const clip = project.clips.find((item) => item.id === clipId)
  if (!clip) {
    throw new Error(`Cannot retarget clip: ${clipId} is not on the timeline`)
  }
  if (!project.assets.some((item) => item.id === assetId)) {
    throw new Error(`Cannot retarget clip: asset ${assetId} is not on the project`)
  }
  if (clip.assetId === assetId) {
    throw new Error('Clip already uses that media')
  }
  return studioProjectSchema.parse({
    ...project,
    clips: project.clips.map((item) => (item.id === clipId ? { ...item, assetId } : item)),
    revision: nextRevision(project),
  })
}

export const addClip = (
  project: StudioProject,
  input: {
    assetId: string
    trackId?: string
    from?: number
    durationInFrames?: number
    trimStartFrames?: number
  },
): StudioProject => {
  const asset = project.assets.find((item) => item.id === input.assetId)
  if (!asset) {
    throw new Error(`Cannot add clip: asset ${input.assetId} is not on the project`)
  }
  const defaultTrackId =
    asset.kind === 'audio'
      ? (project.tracks.find((track) => track.type === 'audio')?.id ?? 'track_audio')
      : mainVideoTrackId(project.tracks)
  const requestedTrackId = input.trackId ? resolveTrackId(project, input.trackId) : defaultTrackId
  // Duration follows content (ADR-0014): auto-fit the project so the clip always
  // fits, instead of rejecting placement past a fixed preset length. Use the
  // asset's natural duration (no preset clamp), then grow the project to fit.
  const durationInFrames =
    input.durationInFrames ??
    (typeof asset.probe.durationFrames === 'number' && asset.probe.durationFrames > 0
      ? asset.probe.durationFrames
      : 90)
  const requestedFrom = input.from ?? 0
  const trackId =
    asset.kind === 'audio'
      ? requestedTrackId
      : resolvePictureTrackId(project, requestedTrackId, requestedFrom, durationInFrames)
  const from = resolveMagneticClipFrom(project, {
    trackId,
    from: requestedFrom,
    durationInFrames,
  })
  assertNoOverlap(project, { trackId, from, durationInFrames })
  assertMainStillFitsBrief(project, {
    trackId,
    from,
    durationInFrames,
    assetKind: asset.kind,
  })
  const clip: ProjectClip = {
    id: `clip_${randomUUID()}`,
    trackId,
    assetId: asset.id,
    from,
    durationInFrames,
    trim: { startFrames: input.trimStartFrames ?? 0 },
  }
  return studioProjectSchema.parse(
    autoFitDuration({
      ...project,
      clips: [...project.clips, clip],
      revision: nextRevision(project),
    }),
  )
}

const clipFingerprint = (clips: StudioProject['clips']): string =>
  clips.map((clip) => `${clip.id}:${clip.trackId}:${clip.from}:${clip.durationInFrames}`).join('|')

/**
 * Drop still-padding after moving video and trim MAIN to the brief window.
 * Used by inspect_preview so mechanical length fails do not wait on the LLM.
 */
export const repairPictureToBrief = (project: StudioProject): StudioProject => {
  const windowFrames = pictureWindowFrames(project)
  if (windowFrames <= 0) return project
  const mainId = mainVideoTrackId(project.tracks)
  const lastVideoEnd = lastMainVideoEndFrames(project)
  const nextClips = project.clips
    .filter((clip) => {
      if (clip.trackId !== mainId) return true
      if (clip.from >= windowFrames) return false
      const asset = project.assets.find((item) => item.id === clip.assetId)
      if (asset?.kind === 'image' && lastVideoEnd > 0 && clip.from >= lastVideoEnd) {
        return false
      }
      return true
    })
    .map((clip) => {
      if (clip.trackId !== mainId) return clip
      const end = clip.from + clip.durationInFrames
      if (end <= windowFrames) return clip
      return { ...clip, durationInFrames: windowFrames - clip.from }
    })
  const clipsChanged = clipFingerprint(nextClips) !== clipFingerprint(project.clips)
  const next = autoFitDuration(clipsChanged ? { ...project, clips: nextClips } : project)
  if (next === project) return project
  return studioProjectSchema.parse({
    ...next,
    revision: nextRevision(project),
  })
}

/** Exclusive end frame of clips on a track (0 when empty). */
export const trackEndFrame = (project: StudioProject, trackId: string): number =>
  project.clips
    .filter((clip) => clip.trackId === trackId)
    .reduce((end, clip) => Math.max(end, clip.from + clip.durationInFrames), 0)

export const placeClip = (project: StudioProject, clipId: string, from: number): StudioProject => {
  const clip = project.clips.find((item) => item.id === clipId)
  if (!clip) {
    throw new Error(`Unknown clip: ${clipId}`)
  }
  if (from < 0) {
    throw new Error('Clip start frame must be non-negative')
  }
  const resolvedFrom = resolveMagneticClipFrom(project, {
    trackId: clip.trackId,
    from,
    durationInFrames: clip.durationInFrames,
    excludeClipId: clipId,
  })
  assertNoOverlap(project, {
    trackId: clip.trackId,
    from: resolvedFrom,
    durationInFrames: clip.durationInFrames,
    excludeClipId: clipId,
  })
  return autoFitDuration(
    studioProjectSchema.parse({
      ...project,
      clips: project.clips.map((item) =>
        item.id === clipId ? { ...item, from: resolvedFrom } : item,
      ),
      revision: nextRevision(project),
    }),
  )
}

/**
 * Remove empty gaps on a track by abutting clips in timeline order.
 * "Close the gap" / "merge clips" / "pack the timeline" — deterministic, no LLM frame math.
 */
export const packClips = (project: StudioProject, input?: { trackId?: string }): StudioProject => {
  const trackId = resolveTrackId(project, input?.trackId)
  const onTrack = project.clips
    .filter((clip) => clip.trackId === trackId)
    .slice()
    .sort((a, b) => a.from - b.from || a.id.localeCompare(b.id))

  if (onTrack.length === 0) {
    throw new Error(`No clips on track ${trackId} to pack`)
  }
  if (onTrack.length === 1) {
    throw new Error(`Only one clip on track ${trackId} — nothing to pack`)
  }

  let cursor = 0
  const packedIds = new Map<string, number>()
  for (const clip of onTrack) {
    packedIds.set(clip.id, cursor)
    cursor += clip.durationInFrames
  }

  const clips = project.clips.map((clip) =>
    packedIds.has(clip.id) ? { ...clip, from: packedIds.get(clip.id)! } : clip,
  )

  return autoFitDuration(
    studioProjectSchema.parse({
      ...project,
      clips,
      revision: nextRevision(project),
    }),
  )
}

/** True when packing the track would move at least one clip (gaps or leading offset). */
export const videoTrackHasPackableGaps = (
  project: StudioProject,
  trackId = 'track_video',
): boolean => {
  const onTrack = project.clips
    .filter((clip) => clip.trackId === trackId)
    .slice()
    .sort((a, b) => a.from - b.from || a.id.localeCompare(b.id))
  if (onTrack.length < 2) return false
  let cursor = 0
  for (const clip of onTrack) {
    if (clip.from !== cursor) return true
    cursor += clip.durationInFrames
  }
  return false
}

export const trimClip = (
  project: StudioProject,
  clipId: string,
  input: { durationInFrames: number; trimStartFrames?: number; from?: number },
): StudioProject => {
  const clip = project.clips.find((item) => item.id === clipId)
  if (!clip) {
    throw new Error(`Unknown clip: ${clipId}`)
  }
  if (input.durationInFrames <= 0) {
    throw new Error('Clip duration must be positive')
  }
  if (input.from !== undefined && input.from < 0) {
    throw new Error('Clip start frame must be non-negative')
  }
  assertNoOverlap(project, {
    trackId: clip.trackId,
    from: input.from ?? clip.from,
    durationInFrames: input.durationInFrames,
    excludeClipId: clipId,
  })
  return autoFitDuration(
    studioProjectSchema.parse({
      ...project,
      clips: project.clips.map((item) =>
        item.id === clipId
          ? {
              ...item,
              from: input.from ?? item.from,
              durationInFrames: input.durationInFrames,
              trim: {
                startFrames: input.trimStartFrames ?? item.trim?.startFrames ?? 0,
                endFrames: item.trim?.endFrames,
              },
            }
          : item,
      ),
      revision: nextRevision(project),
    }),
  )
}

export const removeClip = (project: StudioProject, clipId: string): StudioProject => {
  if (!project.clips.some((item) => item.id === clipId)) {
    throw new Error(`Unknown clip: ${clipId}`)
  }
  return autoFitDuration(
    studioProjectSchema.parse({
      ...project,
      clips: project.clips.filter((item) => item.id !== clipId),
      revision: nextRevision(project),
    }),
  )
}

export const splitClip = (
  project: StudioProject,
  clipId: string,
  atFrame: number,
): StudioProject => {
  const clip = project.clips.find((item) => item.id === clipId)
  if (!clip) {
    throw new Error(`Unknown clip: ${clipId}`)
  }
  const clipEnd = clip.from + clip.durationInFrames
  if (atFrame <= clip.from || atFrame >= clipEnd) {
    throw new Error('Split frame must be inside the clip')
  }
  const leftDuration = atFrame - clip.from
  const rightDuration = clipEnd - atFrame
  const rightClip: ProjectClip = {
    ...clip,
    id: `clip_${randomUUID()}`,
    from: atFrame,
    durationInFrames: rightDuration,
    trim: {
      startFrames: (clip.trim?.startFrames ?? 0) + leftDuration,
      endFrames: clip.trim?.endFrames,
    },
  }
  const clips = project.clips.flatMap((item) =>
    item.id === clipId ? [{ ...item, durationInFrames: leftDuration }, rightClip] : [item],
  )
  return studioProjectSchema.parse({
    ...project,
    clips,
    revision: nextRevision(project),
  })
}

export const rippleDeleteClip = (project: StudioProject, clipId: string): StudioProject => {
  const clip = project.clips.find((item) => item.id === clipId)
  if (!clip) {
    throw new Error(`Unknown clip: ${clipId}`)
  }
  const clipEnd = clip.from + clip.durationInFrames
  const clips = project.clips
    .filter((item) => item.id !== clipId)
    .map((item) =>
      item.trackId === clip.trackId && item.from >= clipEnd
        ? { ...item, from: item.from - clip.durationInFrames }
        : item,
    )
  return autoFitDuration(
    studioProjectSchema.parse({
      ...project,
      clips,
      revision: nextRevision(project),
    }),
  )
}

export const placeOverlay = (
  project: StudioProject,
  overlayId: string,
  input: { from: number; durationInFrames?: number },
): StudioProject => {
  const overlay = project.overlays.find((item) => item.id === overlayId)
  if (!overlay) {
    throw new Error(`Unknown overlay: ${overlayId}`)
  }
  if (input.from < 0) {
    throw new Error('Overlay start frame must be non-negative')
  }
  const durationInFrames = input.durationInFrames ?? overlay.durationInFrames
  if (durationInFrames <= 0) {
    throw new Error('Overlay duration must be positive')
  }
  return autoFitDuration(
    studioProjectSchema.parse({
      ...project,
      overlays: project.overlays.map((item) =>
        item.id === overlayId ? { ...item, from: input.from, durationInFrames } : item,
      ),
      revision: nextRevision(project),
    }),
  )
}

export const removeOverlay = (project: StudioProject, overlayId: string): StudioProject => {
  if (!project.overlays.some((item) => item.id === overlayId)) {
    throw new Error(`Unknown overlay: ${overlayId}`)
  }
  return autoFitDuration(
    studioProjectSchema.parse({
      ...project,
      overlays: project.overlays.filter((item) => item.id !== overlayId),
      revision: nextRevision(project),
    }),
  )
}

const upsertOverlay = (
  project: StudioProject,
  kind: Exclude<OverlayKind, 'sticker'>,
  text: string,
  timing?: {
    from?: number
    durationInFrames?: number
    layout?: OverlayLayout
    style?: OverlayStyle
    libraryItemId?: string
    words?: { text: string; startMs: number; endMs: number }[]
  },
): StudioProject => {
  const from =
    timing?.from ??
    (kind === 'end_card' ? Math.max(0, project.durationFrames - 90) : kind === 'hook_title' ? 0 : 0)
  const durationInFrames =
    timing?.durationInFrames ?? (kind === 'caption' ? Math.min(150, project.durationFrames) : 90)
  const existing = isSingletonOverlayKind(kind)
    ? project.overlays.find((overlay) => overlay.kind === kind)
    : undefined
  const nextOverlay = {
    id: existing?.id ?? `overlay_${randomUUID()}`,
    kind,
    text: String(text ?? '').trim(),
    from,
    durationInFrames,
    layout: timing?.layout ?? existing?.layout,
    style: timing?.style ?? existing?.style,
    libraryItemId: timing?.libraryItemId ?? existing?.libraryItemId,
    words: timing?.words ?? existing?.words,
  }
  if (!nextOverlay.text) {
    throw new Error(`${kind} text cannot be empty`)
  }
  const overlays = existing
    ? project.overlays.map((overlay) => (overlay.id === existing.id ? nextOverlay : overlay))
    : [...project.overlays, nextOverlay]
  return studioProjectSchema.parse({
    ...project,
    overlays,
    revision: nextRevision(project),
  })
}

export const setHookTitle = (project: StudioProject, text: string): StudioProject =>
  upsertOverlay(project, 'hook_title', text, { from: 0, durationInFrames: 90 })

export const setEndCard = (project: StudioProject, text: string): StudioProject => {
  const cardFrames = 90
  const contentEnd = lastContentEndFrames(project)
  const from =
    contentEnd > 0 ? contentEnd + END_CARD_GAP_FRAMES : project.durationFrames - cardFrames
  // Place the card, then grow duration to fit its end (ADR-0014).
  return autoFitDuration(
    upsertOverlay(project, 'end_card', text, { from, durationInFrames: cardFrames }),
  )
}

export const addCaptions = (
  project: StudioProject,
  input: {
    text: string
    from?: number
    durationInFrames?: number
    style?: OverlayStyle
    words?: { text: string; startMs: number; endMs: number }[]
  },
): StudioProject =>
  upsertOverlay(project, 'caption', input.text, {
    from: input.from,
    durationInFrames: input.durationInFrames,
    style: input.style,
    words: input.words,
  })

const TEXT_OVERLAY_KINDS = ['title', 'hook_title', 'end_card', 'lower_third'] as const
type TextOverlayKind = (typeof TEXT_OVERLAY_KINDS)[number]

export const addText = (
  project: StudioProject,
  input: {
    text: string
    kind?: TextOverlayKind
    from?: number
    durationInFrames?: number
    layout?: OverlayLayout
    style?: OverlayStyle
    libraryItemId?: string
  },
): StudioProject => {
  const kind = input.kind ?? 'title'
  if (kind === 'end_card' && input.from === undefined && input.durationInFrames === undefined) {
    const placed = setEndCard(project, input.text)
    if (!input.layout && !input.style && !input.libraryItemId) return placed
    const overlay = placed.overlays.find((item) => item.kind === 'end_card')
    return overlay
      ? updateOverlay(placed, {
          overlayId: overlay.id,
          layout: input.layout,
          style: input.style,
          libraryItemId: input.libraryItemId,
        })
      : placed
  }
  if (kind === 'hook_title' && input.from === undefined && input.durationInFrames === undefined) {
    const placed = setHookTitle(project, input.text)
    if (!input.layout && !input.style && !input.libraryItemId) return placed
    const overlay = placed.overlays.find((item) => item.kind === 'hook_title')
    return overlay
      ? updateOverlay(placed, {
          overlayId: overlay.id,
          layout: input.layout,
          style: input.style,
          libraryItemId: input.libraryItemId,
        })
      : placed
  }
  return autoFitDuration(
    upsertOverlay(project, kind, input.text, {
      from: input.from,
      durationInFrames: input.durationInFrames,
      layout: input.layout,
      style: input.style,
      libraryItemId: input.libraryItemId,
    }),
  )
}

export const updateOverlay = (
  project: StudioProject,
  input: {
    overlayId: string
    text?: string
    from?: number
    durationInFrames?: number
    layout?: OverlayLayout
    style?: OverlayStyle | null
    libraryItemId?: string | null
  },
): StudioProject => {
  const overlay = project.overlays.find((item) => item.id === input.overlayId)
  if (!overlay) {
    throw new Error(`Unknown overlay: ${input.overlayId}`)
  }
  const text = input.text !== undefined ? String(input.text).trim() : overlay.text
  if (overlay.kind !== 'sticker' && !text) {
    throw new Error(`${overlay.kind} text cannot be empty`)
  }
  const from = input.from ?? overlay.from
  const durationInFrames = input.durationInFrames ?? overlay.durationInFrames
  if (from < 0) throw new Error('Overlay start frame must be non-negative')
  if (durationInFrames <= 0) throw new Error('Overlay duration must be positive')
  const layout = input.layout ?? overlay.layout
  const style = input.style === null ? undefined : (input.style ?? overlay.style)
  const libraryItemId =
    input.libraryItemId === null ? undefined : (input.libraryItemId ?? overlay.libraryItemId)
  return autoFitDuration(
    studioProjectSchema.parse({
      ...project,
      overlays: project.overlays.map((item) =>
        item.id === overlay.id
          ? { ...item, text, from, durationInFrames, layout, style, libraryItemId }
          : item,
      ),
      revision: nextRevision(project),
    }),
  )
}

const stickerRole = (asset: ProjectAsset): string | undefined => {
  const role = asset.probe?.role
  return typeof role === 'string' ? role : undefined
}

const stickerProbeId = (asset: ProjectAsset): string | undefined => {
  const stickerId = asset.probe?.stickerId
  return typeof stickerId === 'string' ? stickerId : undefined
}

export const firstPartyStickerAsset = (input: {
  stickerId: string
  blobKey: string
  assetId?: string
}): ProjectAsset => {
  const sticker = getFirstPartySticker(input.stickerId)
  if (!sticker) {
    throw new Error(`Unknown first-party sticker: ${input.stickerId}`)
  }
  return {
    id: input.assetId ?? randomUUID(),
    kind: 'image',
    blobKey: input.blobKey,
    contentType: 'image/svg+xml',
    source: 'generator',
    probe: {
      role: 'sticker',
      stickerId: sticker.id,
      license: 'first-party',
      name: sticker.label,
    },
  }
}

export const findStickerAsset = (
  project: StudioProject,
  stickerId: string,
): ProjectAsset | undefined =>
  project.assets.find(
    (asset) => stickerRole(asset) === 'sticker' && stickerProbeId(asset) === stickerId,
  )

export const placeSticker = (
  project: StudioProject,
  input: {
    stickerId: string
    blobKey?: string
    asset?: ProjectAsset
    from?: number
    durationInFrames?: number
    layout?: OverlayLayout
  },
): StudioProject => {
  const sticker = getFirstPartySticker(input.stickerId)
  if (!sticker) {
    throw new Error(`Unknown first-party sticker: ${input.stickerId}`)
  }
  const existing = findStickerAsset(project, sticker.id)
  const asset =
    input.asset ??
    existing ??
    firstPartyStickerAsset({
      stickerId: sticker.id,
      blobKey:
        input.blobKey ?? `local/marketing-os/${project.productId}/stickers/${sticker.id}.svg`,
    })
  if (asset.kind !== 'image') {
    throw new Error('Sticker asset must be an image')
  }
  const assets = project.assets.some((item) => item.id === asset.id)
    ? project.assets
    : [...project.assets, asset]
  const overlay = {
    id: `overlay_${randomUUID()}`,
    kind: 'sticker' as const,
    text: sticker.label,
    from: input.from ?? 0,
    durationInFrames: input.durationInFrames ?? 90,
    layout: input.layout ?? defaultOverlayLayout('sticker'),
    assetId: asset.id,
    libraryItemId: `first-party:${sticker.id}`,
  }
  return autoFitDuration(
    studioProjectSchema.parse({
      ...project,
      assets,
      overlays: [...project.overlays, overlay],
      revision: nextRevision(project),
    }),
  )
}

export const removeAsset = (project: StudioProject, assetId: string): StudioProject => {
  if (!project.assets.some((item) => item.id === assetId)) {
    throw new Error(`Unknown asset: ${assetId}`)
  }
  let brand = project.brand
  if (brand) {
    const stillIds = (
      brand.stillAssetIds?.length
        ? brand.stillAssetIds
        : brand.stillAssetId
          ? [brand.stillAssetId]
          : []
    ).filter((id) => id !== assetId)
    const next = {
      ...brand,
      logoAssetId: brand.logoAssetId === assetId ? undefined : brand.logoAssetId,
      logoMonoAssetId: brand.logoMonoAssetId === assetId ? undefined : brand.logoMonoAssetId,
      stillAssetIds: stillIds,
      stillAssetId: stillIds[0],
    }
    const hasAny =
      next.logoAssetId ||
      next.logoMonoAssetId ||
      next.stillAssetId ||
      stillIds.length > 0 ||
      next.primaryColor ||
      next.defaultCta
    brand = hasAny ? next : undefined
  }
  return studioProjectSchema.parse({
    ...project,
    assets: project.assets.filter((item) => item.id !== assetId),
    clips: project.clips.filter((clip) => clip.assetId !== assetId),
    brand,
    revision: nextRevision(project),
  })
}

/** Persist a founder-facing display name on the asset (probe.name). */
export const renameAsset = (
  project: StudioProject,
  assetId: string,
  name: string,
): StudioProject => {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Asset name cannot be empty')
  }
  if (trimmed.length > 80) {
    throw new Error('Asset name must be 80 characters or fewer')
  }
  if (!project.assets.some((item) => item.id === assetId)) {
    throw new Error(`Unknown asset: ${assetId}`)
  }
  return studioProjectSchema.parse({
    ...project,
    assets: project.assets.map((item) =>
      item.id === assetId ? { ...item, probe: { ...item.probe, name: trimmed } } : item,
    ),
    revision: nextRevision(project),
  })
}

/** Store word timings on the asset so the Transcript pane and cut list can read them. */
export const writeTranscriptOnAsset = (
  project: StudioProject,
  assetId: string,
  input: { text: string; segments: Array<{ startMs: number; endMs: number; text: string }> },
): StudioProject => {
  if (!project.assets.some((item) => item.id === assetId)) {
    throw new Error(`Unknown asset: ${assetId}`)
  }
  return studioProjectSchema.parse({
    ...project,
    assets: project.assets.map((item) =>
      item.id === assetId
        ? {
            ...item,
            probe: {
              ...item.probe,
              transcriptText: input.text,
              transcriptSegments: input.segments,
            },
          }
        : item,
    ),
    revision: nextRevision(project),
  })
}

export { clearProjectBrand as detachBrandKit, clearProjectBrand } from '../brand/brand-ops'

export const setTrackFlags = (
  project: StudioProject,
  trackId: string,
  flags: { locked?: boolean; hidden?: boolean; muted?: boolean },
): StudioProject => {
  const track = project.tracks.find((item) => item.id === trackId)
  if (!track) {
    throw new Error(`Unknown track: ${trackId}`)
  }
  return studioProjectSchema.parse({
    ...project,
    tracks: project.tracks.map((item) =>
      item.id === trackId
        ? {
            ...item,
            locked: flags.locked ?? item.locked,
            hidden: flags.hidden ?? item.hidden,
            muted: flags.muted ?? item.muted,
          }
        : item,
    ),
    revision: nextRevision(project),
  })
}

export const setCoverFrame = (project: StudioProject, frame: number): StudioProject => {
  if (frame < 0 || frame >= project.durationFrames) {
    throw new Error('Cover frame must be within the project duration')
  }
  return studioProjectSchema.parse({
    ...project,
    coverFrame: frame,
    revision: nextRevision(project),
  })
}
