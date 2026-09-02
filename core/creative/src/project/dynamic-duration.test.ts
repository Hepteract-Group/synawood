import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  addClip,
  attachAsset,
  autoFitDuration,
  fitDurationToContent,
  lastContentEndFrames,
  setDuration,
  setEndCard,
} from './operations'
import { createEmptyProject, type ProjectAsset } from './schema'
import { draftSlides } from './slides'

const FPS = 30

const videoAsset = (durationSeconds: number): ProjectAsset => ({
  id: randomUUID(),
  kind: 'video',
  blobKey: 'local/t.mp4',
  source: 'upload',
  probe: { durationFrames: durationSeconds * FPS },
})

const projectWithClip = (clipSeconds: number, durationSeconds = 60) => {
  const base = createEmptyProject({
    id: randomUUID(),
    productId: 'demo',
    durationFrames: durationSeconds * FPS,
  })
  const asset = videoAsset(clipSeconds)
  const withAsset = attachAsset(base, asset)
  return { project: addClip(withAsset, { assetId: asset.id, from: 0 }), asset }
}

describe('dynamic duration (ADR-0014)', () => {
  it('createEmptyProject honors a durationFrames override', () => {
    const p = createEmptyProject({ id: randomUUID(), productId: 'demo', durationFrames: 300 })
    expect(p.durationFrames).toBe(300)
  })

  it('createEmptyProject defaults to the preset when no override', () => {
    const p = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    expect(p.durationFrames).toBe(1800)
  })

  it('addClip auto-fits duration when content exceeds the current duration', () => {
    const base = createEmptyProject({ id: randomUUID(), productId: 'demo', durationFrames: 150 })
    const asset = videoAsset(20) // 600 frames > 150
    const withAsset = attachAsset(base, asset)
    const next = addClip(withAsset, { assetId: asset.id, from: 0 })
    expect(next.clips).toHaveLength(1)
    expect(next.durationFrames).toBeGreaterThanOrEqual(600)
  })

  it('autoFitDuration grows and shrinks to content + padding', () => {
    const { project } = projectWithClip(10)
    const grown = autoFitDuration({ ...project, durationFrames: 100 })
    expect(grown.durationFrames).toBeGreaterThanOrEqual(lastContentEndFrames(project))
    const large = { ...project, durationFrames: 5000 }
    const fitted = autoFitDuration(large)
    expect(fitted.durationFrames).toBeLessThan(5000)
    expect(fitted.durationFrames).toBeGreaterThanOrEqual(lastContentEndFrames(project))
  })

  it('fitDurationToContent clears dead air', () => {
    const { project } = projectWithClip(3)
    const bloated = { ...project, durationFrames: 117_000 }
    const fitted = fitDurationToContent(bloated)
    expect(fitted.durationFrames).toBeLessThan(200)
    expect(fitted.durationFrames).toBeGreaterThanOrEqual(lastContentEndFrames(project))
  })

  it('setDuration respects an explicit larger value', () => {
    const { project } = projectWithClip(5)
    const next = setDuration(project, 900)
    expect(next.durationFrames).toBe(900)
  })

  it('setDuration never shrinks below placed content', () => {
    const { project } = projectWithClip(20) // 600 frames of content
    const next = setDuration(project, 100)
    expect(next.durationFrames).toBeGreaterThanOrEqual(600)
  })

  it('a 10s upload + end card yields a short project, not 60s of dead air', () => {
    const { project } = projectWithClip(10) // duration preset 60s, content 10s
    const shrunk = setDuration(project, 0) // floor = content end
    const withCard = setEndCard(shrunk, 'example.com')
    const card = withCard.overlays.find((o) => o.kind === 'end_card')
    // end card anchors right after the 10s clip + gap, not at ~57s
    expect(card?.from).toBe(300 + 15)
  })

  it('does not grow a slideshow canvas to a long music clip (#1022)', () => {
    const base = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    const slides = draftSlides({
      presetId: 'ig_carousel_1080',
      headlines: ['Hook', 'Proof', 'CTA', 'Offer', 'Close'],
    })
    const withSlides = {
      ...base,
      slideshow: { ...base.slideshow!, slides },
      durationFrames: 5 * 90,
    }
    const music: ProjectAsset = {
      id: randomUUID(),
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { durationFrames: 840, role: 'music_bed' },
    }
    const withMusic = attachAsset(withSlides, music)
    const next = addClip(withMusic, { assetId: music.id, from: 0, durationInFrames: 840 })
    expect(next.durationFrames).toBe(5 * 90)
  })

  it('authored autoFit follows Sequences / intent, not stacked speech after the bed (#1329)', () => {
    const base = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      durationFrames: 1800,
    })
    const music: ProjectAsset = {
      id: randomUUID(),
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { role: 'music_bed', durationFrames: 1800 },
    }
    const vo: ProjectAsset = {
      id: randomUUID(),
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'generator',
      probe: { text: 'Hello', durationFrames: 535 },
    }
    let project = attachAsset(attachAsset(base, music), vo)
    project = {
      ...project,
      compositionId: 'authored',
      intent: { ...project.intent, lengthSeconds: 60 },
      compositionSource: {
        source: `export default () => (
          <AbsoluteFill>
            <Sequence from={0} durationInFrames={1800}><div /></Sequence>
          </AbsoluteFill>
        )`,
        motionSeed: 'seed',
        compileError: null,
      },
    }
    project = addClip(project, {
      assetId: music.id,
      trackId: 'track_audio',
      from: 0,
      durationInFrames: 1800,
    })
    project = addClip(project, {
      assetId: vo.id,
      trackId: 'track_sfx',
      from: 0,
      durationInFrames: 535,
    })
    const fitted = autoFitDuration({ ...project, durationFrames: 5000 })
    expect(fitted.durationFrames).toBe(1800)
  })
})
