import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  addCaptions,
  addClip,
  addText,
  attachAsset,
  fitDurationToContent,
  packClips,
  placeClip,
  placeOverlay,
  placeSticker,
  removeOverlay,
  renameAsset,
  repairPictureToBrief,
  resolveTrackId,
  rippleDeleteClip,
  setCoverFrame,
  setEndCard,
  setTrackFlags,
  splitClip,
  trackEndFrame,
  trimClip,
  updateOverlay,
  videoTrackHasGaps,
} from './operations'
import { lastMainPictureEndFrames } from './picture-completeness'
import { MAIN_VIDEO_TRACK_ID } from './tracks'
import { createEmptyProject } from './schema'

const withClip = (clipSeconds: number) => {
  const base = createEmptyProject({ id: randomUUID(), productId: 'demo' })
  const fps = 30
  const asset = {
    id: randomUUID(),
    kind: 'video' as const,
    blobKey: 'local/test.mp4',
    source: 'upload' as const,
    probe: { durationFrames: clipSeconds * fps },
  }
  const withAsset = attachAsset(base, asset)
  return addClip(withAsset, { assetId: asset.id, from: 0 })
}

describe('setEndCard content-aware placement', () => {
  it('anchors after the last clip end plus a small gap', () => {
    const project = withClip(10)
    const next = setEndCard(project, 'example.com')
    const card = next.overlays.find((overlay) => overlay.kind === 'end_card')
    expect(card?.from).toBe(300 + 15)
  })

  it('grows past the composition tail when content fills the duration', () => {
    const project = withClip(60)
    const next = setEndCard(project, 'example.com')
    const card = next.overlays.find((overlay) => overlay.kind === 'end_card')
    // ADR-0014: end card anchors after content; duration grows to fit.
    expect(card?.from).toBe(1800 + 15)
    expect(next.durationFrames).toBeGreaterThanOrEqual(1800 + 15 + 90)
  })

  it('falls back to the composition tail when there are no clips', () => {
    const project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    const next = setEndCard(project, 'example.com')
    const card = next.overlays.find((overlay) => overlay.kind === 'end_card')
    expect(card?.from).toBe(1800 - 90)
  })

  it('moves an early end card to the last main picture when MAIN grows (#597)', () => {
    const first = withClip(10)
    const withCard = setEndCard(first, 'example.com')
    const earlyFrom = withCard.overlays.find((overlay) => overlay.kind === 'end_card')?.from
    expect(earlyFrom).toBe(300 + 15)

    const extra = {
      id: randomUUID(),
      kind: 'video' as const,
      blobKey: 'local/more.mp4',
      source: 'upload' as const,
      probe: { durationFrames: 20 * 30 },
    }
    const grown = addClip(attachAsset(withCard, extra), {
      assetId: extra.id,
      from: 10 * 30,
    })
    const card = grown.overlays.find((overlay) => overlay.kind === 'end_card')
    expect(card?.from).toBe(30 * 30 + 15)
  })
})

describe('editable timeline operations', () => {
  it('splits a clip and advances the right source trim', () => {
    const project = withClip(10)
    const original = project.clips[0]
    const next = splitClip(project, original.id, 120)
    const [left, right] = next.clips

    expect(left).toMatchObject({
      id: original.id,
      from: 0,
      durationInFrames: 120,
      trim: { startFrames: 0 },
    })
    expect(right).toMatchObject({
      from: 120,
      durationInFrames: 180,
      trim: { startFrames: 120 },
    })
    expect(right.id).not.toBe(original.id)
    expect(next.revision).toBe(project.revision + 1)
  })

  it('rejects splits at or outside clip boundaries', () => {
    const project = withClip(10)
    const clip = project.clips[0]

    expect(() => splitClip(project, clip.id, clip.from)).toThrow(
      'Split frame must be inside the clip',
    )
    expect(() => splitClip(project, clip.id, clip.from + clip.durationInFrames)).toThrow(
      'Split frame must be inside the clip',
    )
  })

  it('ripple deletes and only shifts later clips on the same track', () => {
    const first = withClip(2)
    const assetId = first.assets[0].id
    const second = addClip(first, { assetId, from: 60, durationInFrames: 60 })
    const third = addClip(second, { assetId, from: 150, durationInFrames: 60 })
    const target = second.clips[1]
    const later = third.clips[2]

    const next = rippleDeleteClip(third, target.id)

    expect(next.clips).toHaveLength(2)
    expect(next.clips.find((clip) => clip.id === later.id)?.from).toBe(90)
    expect(next.clips[0].from).toBe(0)
    expect(next.revision).toBe(third.revision + 1)
  })

  it('snaps add_clip past overlapping clips instead of rejecting', () => {
    const first = withClip(2) // clip at from:0, durationInFrames:60
    const assetId = first.assets[0].id

    const snapped = addClip(first, { assetId, from: 30, durationInFrames: 60 })
    expect(snapped.clips).toHaveLength(2)
    expect(snapped.clips[1]?.from).toBe(60)
    // Exactly adjacent (no overlap) stays put.
    const adjacent = addClip(first, { assetId, from: 60, durationInFrames: 60 })
    expect(adjacent.clips[1]?.from).toBe(60)
  })

  it('magnetically abuts the end when drop leans past the target midpoint', () => {
    const first = withClip(3) // 0-90
    const assetId = first.assets[0].id
    // Preferred 79-169 overlaps 0-90 with midpoint past target mid → land at 90.
    const next = addClip(first, { assetId, from: 79, durationInFrames: 90 })
    expect(next.clips[1]?.from).toBe(90)
  })

  it('magnetically abuts before a later clip when drop leans toward its start', () => {
    const first = withClip(2) // 0-60
    const assetId = first.assets[0].id
    const gapped = addClip(first, { assetId, from: 200, durationInFrames: 60 }) // 200-260
    // Drop overlapping the late clip on its left half → place ending at 200.
    const next = addClip(gapped, { assetId, from: 170, durationInFrames: 60 })
    expect(next.clips.find((clip) => clip.from === 140)).toBeTruthy()
  })

  it('keeps add_clip in a gap when the preferred range already fits', () => {
    const first = withClip(2) // 0-60
    const assetId = first.assets[0].id
    const gapped = addClip(first, { assetId, from: 150, durationInFrames: 60 }) // 150-210
    const mid = addClip(gapped, { assetId, from: 70, durationInFrames: 40 }) // fits in 60-150
    expect(mid.clips.find((clip) => clip.from === 70)?.durationInFrames).toBe(40)
  })

  it('trackEndFrame is exclusive end of clips on a track', () => {
    const first = withClip(2)
    const trackId = first.clips[0].trackId
    expect(trackEndFrame(first, trackId)).toBe(60)
    expect(trackEndFrame(first, 'missing')).toBe(0)

    const assetId = first.assets[0].id
    const second = addClip(first, { assetId, from: 60, durationInFrames: 90 })
    expect(trackEndFrame(second, trackId)).toBe(150)
  })

  it('trackEndFrame returns exclusive end of clips on a track', () => {
    const empty = withClip(2)
    const videoTrack = empty.tracks.find((track) => track.type === 'video')!.id
    expect(trackEndFrame(empty, videoTrack)).toBe(60)

    const audioTrack = empty.tracks.find((track) => track.type === 'audio')!.id
    expect(trackEndFrame(empty, audioTrack)).toBe(0)
  })

  it('magnetically snaps place_clip onto a sibling instead of rejecting', () => {
    const first = withClip(2)
    const assetId = first.assets[0].id
    const project = addClip(first, { assetId, from: 60, durationInFrames: 60 })
    const moving = project.clips[0]!

    // Drag first clip onto the second (from=90 overlaps 60-120) → abut at 120.
    const next = placeClip(project, moving.id, 90)
    expect(next.clips.find((clip) => clip.id === moving.id)?.from).toBe(120)
  })

  it('rejects trim_clip when growing/moving would overlap a sibling clip', () => {
    const first = withClip(2)
    const assetId = first.assets[0].id
    const project = addClip(first, { assetId, from: 60, durationInFrames: 60 })
    const [first_clip] = project.clips

    expect(() => trimClip(project, first_clip.id, { durationInFrames: 90 })).toThrow(/overlap/)
  })

  it('trims clips even when legacy trim metadata is missing', () => {
    const project = withClip(2)
    const clipId = project.clips[0]!.id
    const legacy = {
      ...project,
      clips: project.clips.map((clip) => {
        const { trim: _trim, ...rest } = clip as typeof clip & { trim?: unknown }
        return rest
      }),
    } as typeof project
    const next = trimClip(legacy, clipId, { durationInFrames: 30 })
    expect(next.clips[0]?.durationInFrames).toBe(30)
    expect(next.clips[0]?.trim.startFrames).toBe(0)
  })

  it('renames an asset via probe.name', () => {
    const project = withClip(2)
    const assetId = project.assets[0].id
    const next = renameAsset(project, assetId, 'still-image')
    expect(next.assets[0]?.probe.name).toBe('still-image')
    expect(next.revision).toBe(project.revision + 1)
  })

  it('packs clips to close gaps on the video track', () => {
    const first = withClip(2) // from 0, 60f
    const assetId = first.assets[0].id
    const gapped = addClip(first, { assetId, from: 150, durationInFrames: 60 })
    const packed = packClips(gapped)
    expect(packed.clips.map((clip) => clip.from).sort((a, b) => a - b)).toEqual([0, 60])
    expect(packed.revision).toBe(gapped.revision + 1)
  })

  it('tells fit_duration to use pack_clips when gaps remain but duration is already fitted', () => {
    const first = withClip(2)
    const assetId = first.assets[0].id
    const gapped = addClip(first, { assetId, from: 150, durationInFrames: 60 })
    expect(videoTrackHasGaps(gapped)).toBe(true)
    // addClip already auto-fitted duration to content end — fit_duration must point at pack_clips
    expect(() => fitDurationToContent(gapped)).toThrow(/pack_clips/i)
  })

  it('resolves track alias "video" to track_video for pack_clips', () => {
    const first = withClip(2)
    const assetId = first.assets[0].id
    const gapped = addClip(first, { assetId, from: 150, durationInFrames: 60 })
    const packed = packClips(gapped, { trackId: 'video' })
    expect(packed.clips.map((clip) => clip.from).sort((a, b) => a - b)).toEqual([0, 60])
  })

  it('resolves broll / pip aliases to track_broll', () => {
    const project = withClip(2)
    expect(resolveTrackId(project, 'b-roll')).toBe('track_broll')
    expect(resolveTrackId(project, 'pip')).toBe('track_broll')
    expect(resolveTrackId(project)).toBe('track_video')
  })

  it('throws when pack_clips targets an unknown track', () => {
    const project = withClip(2)
    expect(() => packClips(project, { trackId: 'nope' })).toThrow(/Unknown track/i)
  })

  it('removes an overlay by id', () => {
    const project = addCaptions(withClip(2), { text: 'Caption' })
    const overlay = project.overlays[0]
    const next = removeOverlay(project, overlay.id)

    expect(next.overlays).toEqual([])
    expect(next.revision).toBe(project.revision + 1)
  })

  it('moves an overlay and grows duration to fit', () => {
    const project = addCaptions(withClip(2), { text: 'Caption' })
    const overlay = project.overlays[0]
    const next = placeOverlay(project, overlay.id, { from: 2_400 })

    expect(next.overlays[0].from).toBe(2_400)
    expect(next.durationFrames).toBeGreaterThanOrEqual(2_400 + overlay.durationInFrames)
    expect(next.revision).toBe(project.revision + 1)
  })

  it('resizes an overlay duration', () => {
    const project = addCaptions(withClip(2), { text: 'Caption' })
    const overlay = project.overlays[0]
    const next = placeOverlay(project, overlay.id, {
      from: overlay.from,
      durationInFrames: 45,
    })
    expect(next.overlays[0]?.durationInFrames).toBe(45)
  })

  it('rejects moving an unknown overlay', () => {
    const project = withClip(2)
    expect(() => placeOverlay(project, 'overlay_missing', { from: 0 })).toThrow('Unknown overlay')
  })

  it('places a first-party sticker as an overlay, not a MAIN clip', () => {
    const project = withClip(2)
    const next = placeSticker(project, { stickerId: 'check', from: 30 })
    const overlay = next.overlays.find((item) => item.kind === 'sticker')
    expect(overlay?.assetId).toBeTruthy()
    expect(overlay?.from).toBe(30)
    expect(next.clips).toHaveLength(project.clips.length)
    expect(next.assets.some((asset) => asset.probe?.role === 'sticker')).toBe(true)
  })
})

describe('track chrome + cover', () => {
  it('routes audio assets onto the audio track by default', () => {
    const base = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    const asset = {
      id: randomUUID(),
      kind: 'audio' as const,
      blobKey: 'local/vo.mp3',
      source: 'generator' as const,
      probe: { durationFrames: 120 },
    }
    const next = addClip(attachAsset(base, asset), { assetId: asset.id, from: 0 })
    expect(next.clips[0]?.trackId).toBe('track_audio')
  })

  it('toggles track lock/hide/mute and sets cover frame', () => {
    let project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    project = setTrackFlags(project, 'track_video', { locked: true, muted: true })
    const video = project.tracks.find((track) => track.id === 'track_video')
    expect(video).toMatchObject({ locked: true, muted: true, hidden: false })

    project = setCoverFrame(project, 42)
    expect(project.coverFrame).toBe(42)
  })
})

describe('brief length repair (#601)', () => {
  const stillId = '33333333-3333-4333-8333-333333333333'
  const videoId = '11111111-1111-4111-8111-111111111111'

  const paddedAd = () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 750,
    })
    project = { ...project, intent: { ...project.intent, lengthSeconds: 25 } }
    project = attachAsset(project, {
      id: videoId,
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'upload',
      probe: { durationFrames: 750 },
    })
    project = attachAsset(project, {
      id: stillId,
      kind: 'image',
      blobKey: 'local/still.jpg',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    project = addClip(project, {
      assetId: videoId,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 750,
    })
    return {
      ...project,
      clips: [
        ...project.clips,
        {
          id: 'clip_pad',
          trackId: MAIN_VIDEO_TRACK_ID,
          assetId: stillId,
          from: 750,
          durationInFrames: 750,
          trim: { startFrames: 0 },
        },
      ],
      durationFrames: 1650,
    }
  }

  it('refuses to pad MAIN with a long still after video', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 750,
    })
    project = { ...project, intent: { ...project.intent, lengthSeconds: 25 } }
    project = attachAsset(project, {
      id: videoId,
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'upload',
      probe: { durationFrames: 750 },
    })
    project = attachAsset(project, {
      id: stillId,
      kind: 'image',
      blobKey: 'local/still.jpg',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    project = addClip(project, {
      assetId: videoId,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 750,
    })
    expect(() =>
      addClip(project, {
        assetId: stillId,
        trackId: MAIN_VIDEO_TRACK_ID,
        from: 750,
        durationInFrames: 750,
      }),
    ).toThrow(/pad the ad with still photos/)
  })

  it('drops still padding and trims MAIN to the brief', () => {
    const repaired = repairPictureToBrief(paddedAd())
    expect(lastMainPictureEndFrames(repaired)).toBe(750)
    expect(repaired.clips.some((clip) => clip.id === 'clip_pad')).toBe(false)
    expect(repaired.revision).toBeGreaterThan(paddedAd().revision)
  })

  it('no-ops when the cut already fits the brief', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 750,
    })
    project = { ...project, intent: { ...project.intent, lengthSeconds: 25 } }
    project = attachAsset(project, {
      id: videoId,
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'upload',
      probe: { durationFrames: 750 },
    })
    project = addClip(project, {
      assetId: videoId,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 750,
    })
    expect(repairPictureToBrief(project)).toBe(project)
  })
})

describe('addText / updateOverlay', () => {
  it('appends many titles and upserts hook_title', () => {
    let project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    project = addText(project, { text: 'First title' })
    project = addText(project, { text: 'Second title' })
    expect(project.overlays.filter((overlay) => overlay.kind === 'title')).toHaveLength(2)

    project = addText(project, { kind: 'hook_title', text: 'Hook A' })
    project = addText(project, { kind: 'hook_title', text: 'Hook B' })
    const hooks = project.overlays.filter((overlay) => overlay.kind === 'hook_title')
    expect(hooks).toHaveLength(1)
    expect(hooks[0]?.text).toBe('Hook B')
  })

  it('places end_card via addText the same way as setEndCard', () => {
    let project = withClip(4)
    project = addText(project, { kind: 'end_card', text: 'Try the private example' })
    const viaAdd = project.overlays.find((overlay) => overlay.kind === 'end_card')
    const viaSet = setEndCard(withClip(4), 'Try the private example').overlays.find(
      (overlay) => overlay.kind === 'end_card',
    )
    expect(viaAdd?.from).toBe(viaSet?.from)
    expect(viaAdd?.durationInFrames).toBe(viaSet?.durationInFrames)
  })

  it('patches copy and layout on an existing overlay', () => {
    let project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    project = addText(project, {
      text: 'Draft',
      layout: { x: 0.1, y: 0.1, width: 0.5, height: 0.2, rotation: 0 },
    })
    const overlayId = project.overlays[0]?.id
    expect(overlayId).toBeTruthy()
    project = updateOverlay(project, {
      overlayId: overlayId!,
      text: 'Final',
      layout: { x: 0.2, y: 0.3, width: 0.6, height: 0.25, rotation: 5 },
    })
    expect(project.overlays[0]).toMatchObject({
      text: 'Final',
      layout: { x: 0.2, y: 0.3, width: 0.6, height: 0.25, rotation: 5 },
    })
  })
})
