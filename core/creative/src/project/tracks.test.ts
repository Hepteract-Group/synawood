import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './schema'
import { addCaptions, setHookTitle } from './operations'
import { overlaysForTrack, trackTypeForOverlayKind, ensureDefaultTracks } from './tracks'

describe('overlay/caption lanes (Phase 2a)', () => {
  it('routes caption kinds to the caption track and chrome to overlay', () => {
    expect(trackTypeForOverlayKind('caption')).toBe('caption')
    expect(trackTypeForOverlayKind('hook_title')).toBe('overlay')
    expect(trackTypeForOverlayKind('end_card')).toBe('overlay')
    expect(trackTypeForOverlayKind('title')).toBe('overlay')
    expect(trackTypeForOverlayKind('sticker')).toBe('overlay')
  })

  it('filters overlays onto the correct lane', () => {
    let project = createEmptyProject({
      id: '33333333-3333-4333-8333-333333333333',
      productId: 'demo',
    })
    project = setHookTitle(project, 'Hook')
    project = addCaptions(project, { text: 'Caption line' })

    const captions = overlaysForTrack(project.overlays, 'caption')
    const chrome = overlaysForTrack(project.overlays, 'overlay')

    expect(captions).toHaveLength(1)
    expect(captions[0]?.kind).toBe('caption')
    expect(chrome).toHaveLength(1)
    expect(chrome[0]?.kind).toBe('hook_title')
    expect(overlaysForTrack(project.overlays, 'video')).toEqual([])
  })

  it('adds track_broll to legacy four-track projects without renaming A-roll', () => {
    const project = createEmptyProject({
      id: '33333333-3333-4333-8333-333333333333',
      productId: 'demo',
    })
    const legacy = {
      ...project,
      tracks: project.tracks.filter((track) => track.id !== 'track_broll'),
    }
    const next = ensureDefaultTracks(legacy)
    expect(next.tracks.some((track) => track.id === 'track_video')).toBe(true)
    expect(next.tracks.some((track) => track.id === 'track_broll')).toBe(true)
    expect(next.tracks.filter((track) => track.type === 'video')).toHaveLength(2)
  })

  it('adds track_sfx to legacy five-track projects without stealing the music lane', () => {
    const project = createEmptyProject({
      id: '33333333-3333-4333-8333-333333333333',
      productId: 'demo',
    })
    const legacy = {
      ...project,
      tracks: project.tracks.filter((track) => track.id !== 'track_sfx'),
    }
    const next = ensureDefaultTracks(legacy)
    expect(next.tracks.some((track) => track.id === 'track_audio')).toBe(true)
    expect(next.tracks.some((track) => track.id === 'track_sfx')).toBe(true)
    expect(next.tracks.filter((track) => track.type === 'audio')).toHaveLength(2)
  })
})
