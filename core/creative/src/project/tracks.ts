import type { ProjectOverlay, ProjectTrack, StudioProject } from './schema'

export const MAIN_VIDEO_TRACK_ID = 'track_video'
export const BROLL_TRACK_ID = 'track_broll'
export const SFX_TRACK_ID = 'track_sfx'

const DEFAULT_TRACKS: Array<{ id: string; type: ProjectTrack['type']; order: number }> = [
  { id: MAIN_VIDEO_TRACK_ID, type: 'video', order: 0 },
  { id: BROLL_TRACK_ID, type: 'video', order: 1 },
  { id: 'track_audio', type: 'audio', order: 2 },
  { id: SFX_TRACK_ID, type: 'audio', order: 3 },
  { id: 'track_caption', type: 'caption', order: 4 },
  { id: 'track_overlay', type: 'overlay', order: 5 },
]

/** Stable default track list for new projects (Phase 2b includes B-roll). */
export const defaultStudioTracks = (): ProjectTrack[] =>
  DEFAULT_TRACKS.map((spec) => ({
    id: spec.id,
    type: spec.type,
    order: spec.order,
    locked: false,
    hidden: false,
    muted: false,
  }))

export const isBrollTrack = (track: Pick<ProjectTrack, 'id'>): boolean =>
  track.id === BROLL_TRACK_ID

export const mainVideoTrackId = (tracks: readonly ProjectTrack[]): string =>
  tracks.find((track) => track.id === MAIN_VIDEO_TRACK_ID)?.id ??
  tracks.find((track) => track.type === 'video' && track.id !== BROLL_TRACK_ID)?.id ??
  MAIN_VIDEO_TRACK_ID

/** Lane type for an overlay kind (Phase 2a — caption vs chrome overlays). */
export const trackTypeForOverlayKind = (kind: ProjectOverlay['kind']): 'caption' | 'overlay' =>
  kind === 'caption' ? 'caption' : 'overlay'

/** Overlays that belong on a caption or overlay track lane. */
export const overlaysForTrack = (
  overlays: ProjectOverlay[],
  trackType: ProjectTrack['type'],
): ProjectOverlay[] => {
  if (trackType === 'caption') {
    return overlays.filter((overlay) => overlay.kind === 'caption')
  }
  if (trackType === 'overlay') {
    return overlays.filter((overlay) => overlay.kind !== 'caption')
  }
  return []
}

const sameTrack = (a: ProjectTrack, b: ProjectTrack): boolean =>
  a.id === b.id &&
  a.type === b.type &&
  a.order === b.order &&
  a.locked === b.locked &&
  a.hidden === b.hidden &&
  a.muted === b.muted

/**
 * Ensure default tracks exist by id (ADR-0046). Additive: legacy single-video
 * projects keep their A-roll and gain `track_broll`. Extra custom tracks stay.
 */
export const ensureDefaultTracks = (project: StudioProject): StudioProject => {
  const used = new Set<string>()
  const byId = new Map(project.tracks.map((track) => [track.id, track]))

  const nextDefaults: ProjectTrack[] = DEFAULT_TRACKS.map((spec) => {
    const existingById = byId.get(spec.id)
    if (existingById) {
      used.add(existingById.id)
      return { ...existingById, type: spec.type, order: spec.order }
    }
    if (spec.id !== BROLL_TRACK_ID && spec.id !== SFX_TRACK_ID) {
      const promote = project.tracks.find(
        (track) =>
          track.type === spec.type &&
          !used.has(track.id) &&
          track.id !== BROLL_TRACK_ID &&
          track.id !== SFX_TRACK_ID,
      )
      if (promote) {
        used.add(promote.id)
        return { ...promote, order: spec.order }
      }
    }
    return {
      id: spec.id,
      type: spec.type,
      order: spec.order,
      locked: false,
      hidden: false,
      muted: false,
    }
  })

  const extras = project.tracks
    .filter((track) => !used.has(track.id) && !DEFAULT_TRACKS.some((spec) => spec.id === track.id))
    .map((track, index) => ({ ...track, order: DEFAULT_TRACKS.length + index }))

  const nextTracks = [...nextDefaults, ...extras]
  const unchanged =
    nextTracks.length === project.tracks.length &&
    nextTracks.every((track, index) => {
      const current = project.tracks[index]
      return current !== undefined && sameTrack(track, current)
    })

  if (unchanged) {
    return project
  }

  return { ...project, tracks: nextTracks }
}
