import { describe, expect, it } from 'vitest'
import { addClip, attachAsset } from './operations'
import {
  evaluatePictureCompleteness,
  lastMainVideoAssetId,
  maxStillEndCardFrames,
  overlayLayoutIsReadable,
  pictureWindowFrames,
  projectHasMusicBed,
  projectHasVoiceover,
  remainingBriefVideoSeconds,
  resolvePictureTrackId,
} from './picture-completeness'
import { DEFAULT_PIP_LAYOUT } from './pip-layout'
import { createEmptyProject, type StudioProject } from './schema'
import { draftSlides } from './slides'
import { BROLL_TRACK_ID, MAIN_VIDEO_TRACK_ID } from './tracks'

const VIDEO_ID = '11111111-1111-4111-8111-111111111111'
const STILL_ID = '33333333-3333-4333-8333-333333333333'
const MUSIC_ID = '44444444-4444-4444-8444-444444444444'

const emptyAd = (lengthSeconds = 30): StudioProject => {
  const project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
    durationFrames: lengthSeconds * 30,
  })
  return {
    ...project,
    intent: { ...project.intent, lengthSeconds },
  }
}

const withAssets = (lengthSeconds = 30) => {
  let project = emptyAd(lengthSeconds)
  project = attachAsset(project, {
    id: VIDEO_ID,
    kind: 'video',
    blobKey: 'local/a.mp4',
    source: 'upload',
    probe: { durationFrames: 900 },
  })
  project = attachAsset(project, {
    id: STILL_ID,
    kind: 'image',
    blobKey: 'local/still.png',
    source: 'generator',
    probe: { durationFrames: 90 },
  })
  project = attachAsset(project, {
    id: MUSIC_ID,
    kind: 'audio',
    blobKey: 'local/bed.mp3',
    source: 'generator',
    probe: { durationFrames: 900, role: 'music_bed' },
  })
  return project
}

const branded = (project: StudioProject): StudioProject => ({
  ...project,
  brand: {
    productId: 'demo',
    primaryColor: '#0B1F33',
    logoAssetId: STILL_ID,
  },
})

const withMusicBed = (project: StudioProject): StudioProject =>
  addClip(project, {
    assetId: MUSIC_ID,
    from: 0,
    durationInFrames: 900,
  })

const coveredVideo = (lengthSeconds = 30): StudioProject =>
  addClip(withAssets(lengthSeconds), {
    assetId: VIDEO_ID,
    trackId: MAIN_VIDEO_TRACK_ID,
    from: 0,
    durationInFrames: lengthSeconds * 30,
  })

describe('picture completeness (#551)', () => {
  it('uses 30s when intent does not name a length, capped at 120s', () => {
    const unnamed = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    expect(pictureWindowFrames(unnamed)).toBe(30 * unnamed.fps)
    const named = emptyAd(45)
    expect(pictureWindowFrames(named)).toBe(45 * named.fps)
  })

  it('keeps a 15s brief when the empty canvas is shorter than the intent (#644)', () => {
    const shortCanvas = {
      ...emptyAd(15),
      durationFrames: 8 * 30,
    }
    expect(pictureWindowFrames(shortCanvas)).toBe(15 * 30)
    expect(remainingBriefVideoSeconds(shortCanvas)).toBe(15)
  })

  it('fails an empty main track across the requested length', () => {
    const report = evaluatePictureCompleteness(emptyAd())
    expect(report.ok).toBe(false)
    expect(report.failures.some((row) => row.code === 'uncovered_main')).toBe(true)
    expect(report.failures[0]?.uncoveredSeconds?.[0]).toBe(0)
    expect(report.failures[0]?.uncoveredSeconds?.at(-1)).toBe(29)
  })

  it('fails a stills-only main track (logo slideshow is not an ad)', () => {
    const project = addClip(withAssets(), {
      assetId: STILL_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 900,
    })
    const report = evaluatePictureCompleteness(project)
    expect(report.ok).toBe(false)
    expect(report.failures.some((row) => row.code === 'stills_only_main')).toBe(true)
  })

  it('allows a still end card after moving video on main', () => {
    let project = addClip(withAssets(), {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 810,
    })
    project = addClip(project, {
      assetId: STILL_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 810,
      durationInFrames: 90,
    })
    expect(evaluatePictureCompleteness(branded(withMusicBed(project))).ok).toBe(true)
  })

  it('caps still end cards at 3 seconds of this project fps (#606)', () => {
    expect(maxStillEndCardFrames(24)).toBe(72)
    expect(maxStillEndCardFrames(60)).toBe(180)
    const base = { ...withAssets(15), fps: 24 }
    const project = {
      ...base,
      clips: [
        {
          id: 'clip_video',
          trackId: MAIN_VIDEO_TRACK_ID,
          assetId: VIDEO_ID,
          from: 0,
          durationInFrames: 240,
          trim: { startFrames: 0 },
        },
        {
          id: 'clip_pad',
          trackId: MAIN_VIDEO_TRACK_ID,
          assetId: STILL_ID,
          from: 240,
          durationInFrames: 90,
          trim: { startFrames: 0 },
        },
      ],
    }
    expect(
      evaluatePictureCompleteness(branded(withMusicBed(project))).failures.some(
        (row) => row.code === 'stills_padding_main',
      ),
    ).toBe(true)

    const allowed = {
      ...project,
      clips: [project.clips[0]!, { ...project.clips[1]!, durationInFrames: 72 }],
    }
    expect(
      evaluatePictureCompleteness(branded(withMusicBed(allowed))).failures.some(
        (row) => row.code === 'stills_padding_main',
      ),
    ).toBe(false)
  })

  it('passes when moving video covers the whole requested length', () => {
    const report = evaluatePictureCompleteness(branded(withMusicBed(coveredVideo())))
    expect(report.ok).toBe(true)
  })

  it('fails when the cut has no music bed (#642)', () => {
    const report = evaluatePictureCompleteness(branded(coveredVideo()))
    expect(report.ok).toBe(false)
    expect(report.failures.some((row) => row.code === 'missing_music')).toBe(true)
  })

  it('fails when the project has no brand kit (#642)', () => {
    const report = evaluatePictureCompleteness(withMusicBed(coveredVideo()))
    expect(report.ok).toBe(false)
    expect(report.failures.some((row) => row.code === 'missing_brand')).toBe(true)
  })

  it('fails when brand has colour but no logo (#1058)', () => {
    const project = withMusicBed(coveredVideo())
    const colourOnly = {
      ...project,
      brand: { productId: 'demo', primaryColor: '#0B1F33', fontFamily: 'Inter' },
    }
    const report = evaluatePictureCompleteness(colourOnly)
    expect(report.ok).toBe(false)
    expect(report.failures.some((row) => row.code === 'missing_brand')).toBe(true)
    expect(report.failures.find((row) => row.code === 'missing_brand')?.message).toMatch(
      /Brand Studio/i,
    )
  })

  it('reroutes overlay onto main when main has no picture in that window', () => {
    const project = withAssets()
    expect(resolvePictureTrackId(project, BROLL_TRACK_ID, 0, 90)).toBe(MAIN_VIDEO_TRACK_ID)
    const placed = addClip(project, {
      assetId: STILL_ID,
      trackId: BROLL_TRACK_ID,
      from: 0,
      durationInFrames: 90,
    })
    expect(placed.clips[0]?.trackId).toBe(MAIN_VIDEO_TRACK_ID)
  })

  it('keeps overlay on the overlay track when main already has picture', () => {
    let project = addClip(withAssets(), {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 900,
    })
    project = addClip(project, {
      assetId: STILL_ID,
      trackId: BROLL_TRACK_ID,
      from: 0,
      durationInFrames: 90,
    })
    expect(project.clips.some((clip) => clip.trackId === BROLL_TRACK_ID)).toBe(true)
    expect(evaluatePictureCompleteness(branded(withMusicBed(project))).ok).toBe(true)
  })

  it('fails music that outlasts main picture', () => {
    let project = addClip(withAssets(), {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 90,
    })
    project = addClip(project, {
      assetId: MUSIC_ID,
      from: 0,
      durationInFrames: 900,
    })
    const report = evaluatePictureCompleteness(project)
    expect(report.failures.some((row) => row.code === 'audio_over_black')).toBe(true)
  })

  it('uses a readable default overlay layout (news/split, not a stamp)', () => {
    expect(DEFAULT_PIP_LAYOUT.mode).toBe('split')
    expect(overlayLayoutIsReadable(DEFAULT_PIP_LAYOUT)).toBe(true)
    expect(
      overlayLayoutIsReadable({
        mode: 'pip',
        x: 0.58,
        y: 0.68,
        width: 0.38,
        height: 0.22,
      }),
    ).toBe(false)
  })

  it('treats an empty slideshow as having no ad window', () => {
    const slides = createEmptyProject({
      id: '55555555-5555-4555-8555-555555555555',
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    expect(pictureWindowFrames(slides)).toBe(0)
    expect(evaluatePictureCompleteness(slides).ok).toBe(true)
  })

  it('requires music and brand on a slideshow with slides (#682)', () => {
    const base = createEmptyProject({
      id: '55555555-5555-4555-8555-555555555555',
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    const slides = draftSlides({ presetId: 'ig_carousel_1080', headlines: ['Hook'] }).map(
      (slide) => ({ ...slide, backgroundAssetId: STILL_ID }),
    )
    const withSlides = {
      ...base,
      durationFrames: 90,
      slideshow: {
        ...base.slideshow!,
        slides,
      },
    }
    expect(pictureWindowFrames(withSlides)).toBeGreaterThan(0)
    const report = evaluatePictureCompleteness(withSlides)
    expect(report.ok).toBe(false)
    expect(report.failures.map((row) => row.code)).toEqual(['missing_music', 'missing_brand'])

    let ready = attachAsset(withSlides, {
      id: MUSIC_ID,
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { durationFrames: 90, role: 'music_bed' },
    })
    ready = attachAsset(ready, {
      id: STILL_ID,
      kind: 'image',
      blobKey: 'local/bg.png',
      source: 'generator',
      probe: {},
    })
    ready = addClip(ready, { assetId: MUSIC_ID, from: 0, durationInFrames: 90 })
    ready = branded(ready)
    ready = { ...ready, durationFrames: pictureWindowFrames(ready) }
    expect(evaluatePictureCompleteness(ready).ok).toBe(true)
  })

  it('fails a slideshow canvas longer than the slides (#1022)', () => {
    const base = createEmptyProject({
      id: '55555555-5555-4555-8555-555555555555',
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    const slides = draftSlides({
      presetId: 'ig_carousel_1080',
      headlines: ['Hook', 'Proof', 'CTA', 'Offer', 'Close'],
    }).map((slide) => ({ ...slide, backgroundAssetId: STILL_ID }))
    let project: StudioProject = {
      ...base,
      durationFrames: 900,
      slideshow: { ...base.slideshow!, slides },
    }
    project = attachAsset(project, {
      id: STILL_ID,
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
      probe: { durationFrames: 900, role: 'music_bed' },
    })
    project = addClip(project, { assetId: MUSIC_ID, from: 0, durationInFrames: 900 })
    project = branded(project)
    const report = evaluatePictureCompleteness({ ...project, durationFrames: 900 })
    expect(pictureWindowFrames(project)).toBe(5 * 90)
    expect(report.ok).toBe(false)
    expect(report.failures.map((row) => row.code)).toContain('uncovered_slideshow')
  })

  it('fails slideshow slides that have no background (#1022)', () => {
    const base = createEmptyProject({
      id: '55555555-5555-4555-8555-555555555555',
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    const withSlides = {
      ...base,
      durationFrames: 90,
      slideshow: {
        ...base.slideshow!,
        slides: draftSlides({ presetId: 'ig_carousel_1080', headlines: ['Hook'] }),
      },
    }
    let ready = attachAsset(withSlides, {
      id: MUSIC_ID,
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { durationFrames: 90, role: 'music_bed' },
    })
    ready = addClip(ready, { assetId: MUSIC_ID, from: 0, durationInFrames: 90 })
    ready = branded(ready)
    ready = { ...ready, durationFrames: 90 }
    const report = evaluatePictureCompleteness(ready)
    expect(report.ok).toBe(false)
    expect(report.failures.map((row) => row.code)).toContain('missing_slide_background')
  })

  it('fails an end card that finishes before the last main picture (#597)', () => {
    let project = addClip(withAssets(), {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 900,
    })
    project = {
      ...project,
      overlays: [
        {
          id: 'overlay_end',
          kind: 'end_card',
          text: 'example.com',
          from: 600,
          durationInFrames: 90,
        },
      ],
    }
    const report = evaluatePictureCompleteness(project)
    expect(report.failures.some((row) => row.code === 'end_card_early')).toBe(true)
  })

  it('fails an end card that starts mid-picture even if it outlasts MAIN (#597)', () => {
    let project = addClip(withAssets(), {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 900,
    })
    project = {
      ...project,
      overlays: [
        {
          id: 'overlay_end',
          kind: 'end_card',
          text: 'example.com',
          from: 600,
          durationInFrames: 400,
        },
      ],
    }
    const report = evaluatePictureCompleteness(project)
    expect(report.failures.some((row) => row.code === 'end_card_early')).toBe(true)
  })

  it('fails a cut that overshoots the requested length by more than 5s (#597)', () => {
    const project = addClip(withAssets(), {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 43 * 30,
    })
    const report = evaluatePictureCompleteness({
      ...project,
      durationFrames: 43 * 30,
      intent: { ...project.intent, lengthSeconds: 25 },
    })
    expect(report.failures.some((row) => row.code === 'cut_longer_than_brief')).toBe(true)
  })

  it('fails stills padded after moving video (#601)', () => {
    const base = addClip(withAssets(25), {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 750,
    })
    const project = {
      ...base,
      clips: [
        {
          id: 'clip_video',
          trackId: MAIN_VIDEO_TRACK_ID,
          assetId: VIDEO_ID,
          from: 0,
          durationInFrames: 750,
          trim: { startFrames: 0 },
        },
        {
          id: 'clip_pad',
          trackId: MAIN_VIDEO_TRACK_ID,
          assetId: STILL_ID,
          from: 750,
          durationInFrames: 750,
          trim: { startFrames: 0 },
        },
      ],
      durationFrames: 1650,
      intent: { ...base.intent, lengthSeconds: 25 },
    }
    const report = evaluatePictureCompleteness(project)
    expect(report.failures.some((row) => row.code === 'stills_padding_main')).toBe(true)
  })

  it('counts remaining brief seconds from moving video, not stills (#601)', () => {
    const empty = withAssets(25)
    expect(remainingBriefVideoSeconds(empty)).toBe(25)
    const withVideo = addClip(empty, {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 750,
    })
    expect(remainingBriefVideoSeconds(withVideo)).toBe(0)
  })

  it('names the last MAIN video asset so the next generate can continue it (#646)', () => {
    let project = addClip(withAssets(15), {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 8 * 30,
    })
    expect(lastMainVideoAssetId(project)).toBe(VIDEO_ID)
    project = addClip(project, {
      assetId: STILL_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 8 * 30,
      durationInFrames: 90,
    })
    expect(lastMainVideoAssetId(project)).toBe(VIDEO_ID)
  })
})

describe('projectHasVoiceover', () => {
  it('does not treat a music bed as spoken VO', () => {
    const project = addClip(withAssets(15), {
      assetId: MUSIC_ID,
      trackId: 'track_audio',
      from: 0,
      durationInFrames: 90,
    })
    expect(projectHasMusicBed(project)).toBe(true)
    expect(projectHasVoiceover(project)).toBe(false)
  })

  it('detects a spoken clip that covers frame 0', () => {
    const voId = '55555555-5555-4555-8555-555555555555'
    let project = attachAsset(emptyAd(15), {
      id: voId,
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'generator',
      probe: { text: 'Hello grads.', durationFrames: 90 },
    })
    project = addClip(project, {
      assetId: voId,
      trackId: 'track_sfx',
      from: 0,
      durationInFrames: 90,
    })
    expect(projectHasVoiceover(project)).toBe(true)
  })

  it('ignores spoken clips that start after the picture (#1329)', () => {
    const voId = '55555555-5555-4555-8555-555555555555'
    let project = attachAsset(withAssets(60), {
      id: voId,
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'generator',
      probe: { text: 'Hello grads.', durationFrames: 90 },
    })
    project = addClip(project, {
      assetId: MUSIC_ID,
      trackId: 'track_audio',
      from: 0,
      durationInFrames: 1800,
    })
    project = addClip(project, {
      assetId: voId,
      trackId: 'track_audio',
      from: 1800,
      durationInFrames: 90,
    })
    expect(projectHasVoiceover(project)).toBe(false)
  })
})
