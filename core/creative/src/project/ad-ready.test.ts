import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { addClip, attachAsset } from './operations'
import { listAdReadyIssues } from './ad-ready'
import { stampPassedCutReview } from './cut-review-state'
import { createEmptyProject } from './schema'
import { draftSlides } from './slides'
import { MAIN_VIDEO_TRACK_ID } from './tracks'

const MUSIC_ID = '44444444-4444-4444-8444-444444444444'
const VIDEO_ID = '11111111-1111-4111-8111-111111111111'
const LOGO_ID = '33333333-3333-4333-8333-333333333333'

describe('listAdReadyIssues', () => {
  it('flags missing music, brand, and cut review on a slideshow with slides', () => {
    const base = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    const project = {
      ...base,
      slideshow: {
        ...base.slideshow!,
        slides: draftSlides({ presetId: 'ig_carousel_1080', headlines: ['Hook'] }),
      },
    }
    const codes = listAdReadyIssues(project).map((row) => row.code)
    expect(codes).toContain('missing_music')
    expect(codes).toContain('missing_brand')
    expect(codes).toContain('cut_review')
  })

  it('is empty once slideshow has music, brand, and a fresh cut review', () => {
    let project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    project = {
      ...project,
      slideshow: {
        ...project.slideshow!,
        slides: draftSlides({ presetId: 'ig_carousel_1080', headlines: ['Hook'] }).map((slide) => ({
          ...slide,
          backgroundAssetId: LOGO_ID,
        })),
      },
      brand: { productId: 'demo', primaryColor: '#0B1F33', logoAssetId: LOGO_ID },
    }
    project = attachAsset(project, {
      id: LOGO_ID,
      kind: 'image',
      blobKey: 'local/bg.png',
      source: 'generator',
      probe: {},
    })
    project = attachAsset(project, {
      id: MUSIC_ID,
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { durationFrames: 90, role: 'music_bed' },
    })
    project = addClip(project, { assetId: MUSIC_ID, from: 0, durationInFrames: 90 })
    project = stampPassedCutReview(project, [0, 45, 89], 'ok')
    expect(listAdReadyIssues(project)).toEqual([])
  })

  it('still requires cut review on a covered talking-head cut', () => {
    let project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      durationFrames: 900,
    })
    project = { ...project, intent: { ...project.intent, lengthSeconds: 30 } }
    project = attachAsset(project, {
      id: VIDEO_ID,
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'upload',
      probe: { durationFrames: 900 },
    })
    project = attachAsset(project, {
      id: MUSIC_ID,
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { durationFrames: 900, role: 'music_bed' },
    })
    project = addClip(project, {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 900,
    })
    project = addClip(project, { assetId: MUSIC_ID, from: 0, durationInFrames: 900 })
    project = {
      ...project,
      brand: { productId: 'demo', primaryColor: '#0B1F33' },
    }
    expect(listAdReadyIssues(project).map((row) => row.code)).toEqual([
      'missing_brand',
      'cut_review',
    ])
  })

  it('requires cut review on an authored composition even with no MAIN clips', () => {
    const project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'authored',
    })
    expect(listAdReadyIssues(project).map((row) => row.code)).toContain('cut_review')
  })
})
