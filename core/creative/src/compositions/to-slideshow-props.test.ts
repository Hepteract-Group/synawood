import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createEmptyProject, draftSlides, parseStudioProject } from '../project'
import { addClip, attachAsset } from '../project/operations'
import { totalSlideshowFrames } from './slideshow'
import { toSlideshowProps } from './to-slideshow-props'

describe('toSlideshowProps', () => {
  it('maps ordered slides + preset safe margins', () => {
    const base = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    const bgId = randomUUID()
    const slides = draftSlides({
      presetId: 'ig_carousel_1080',
      headlines: ['Hook', 'Proof', 'CTA'],
    }).map((slide, index) =>
      index === 0 ? { ...slide, backgroundAssetId: bgId, transition: 'kenBurns' as const } : slide,
    )
    const project = parseStudioProject({
      ...base,
      assets: [
        {
          id: bgId,
          kind: 'image',
          blobKey: 'local/bg.png',
          source: 'generator',
          probe: {},
        },
      ],
      slideshow: {
        presetId: 'ig_carousel_1080',
        slides,
        voiceoverMode: 'none',
      },
      brand: {
        productId: 'demo',
        primaryColor: '#1f6b4a',
        fontFamily: 'Georgia, serif',
      },
    })

    const props = toSlideshowProps(project, (key) => `https://cdn.test/${key}`)
    expect(props.slides).toHaveLength(3)
    expect(props.slides[0]?.backgroundSrc).toBe('https://cdn.test/local/bg.png')
    expect(props.slides[0]?.transition).toBe('kenBurns')
    expect(props.safeMargins.top).toBe(64)
    expect(props.primaryColor).toBe('#1f6b4a')
    expect(props.durationInFrames).toBe(totalSlideshowFrames(props.slides))
  })

  it('does not extend the composition past the last slide (#1022)', () => {
    const base = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
      durationFrames: 900,
    })
    const slides = draftSlides({
      presetId: 'ig_carousel_1080',
      headlines: ['Hook', 'Proof', 'CTA', 'Offer', 'Close'],
    })
    const project = parseStudioProject({
      ...base,
      durationFrames: 900,
      slideshow: {
        presetId: 'ig_carousel_1080',
        slides,
        voiceoverMode: 'none',
      },
    })
    const props = toSlideshowProps(project, () => '')
    expect(totalSlideshowFrames(props.slides)).toBe(5 * 90)
    expect(props.durationInFrames).toBe(5 * 90)
    expect(props.durationInFrames).toBeLessThan(project.durationFrames)
  })

  it('uses TikTok safe margins for vertical-slideshow', () => {
    const project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'vertical-slideshow',
      slideshowPresetId: 'tiktok_slideshow_9x16',
    })
    const withSlides = parseStudioProject({
      ...project,
      slideshow: {
        presetId: 'tiktok_slideshow_9x16',
        slides: draftSlides({
          presetId: 'tiktok_slideshow_9x16',
          headlines: ['One', 'Two', 'Three'],
        }),
        voiceoverMode: 'none',
      },
    })
    const props = toSlideshowProps(withSlides, () => '')
    expect(props.safeMargins.bottom).toBe(220)
    expect(props.slides).toHaveLength(3)
  })

  it('maps a music bed and style pack onto the composition (#682 #684)', () => {
    let project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    const musicId = randomUUID()
    project = {
      ...project,
      stylePackId: 'vhs',
      slideshow: {
        ...project.slideshow!,
        slides: draftSlides({
          presetId: 'ig_carousel_1080',
          headlines: ['Hook'],
        }),
      },
    }
    project = attachAsset(project, {
      id: musicId,
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { role: 'music_bed' },
    })
    project = addClip(project, { assetId: musicId, from: 0, durationInFrames: 90 })
    const props = toSlideshowProps(project, (key) => `https://cdn.test/${key}`)
    expect(props.musicSrc).toBe('https://cdn.test/local/bed.mp3')
    expect(props.stylePackId).toBe('vhs')
  })
})

describe('totalSlideshowFrames', () => {
  it('sums slide durations', () => {
    expect(
      totalSlideshowFrames([
        { headline: 'a', durationInFrames: 90, transition: 'cut' },
        { headline: 'b', durationInFrames: 75, transition: 'fade' },
      ]),
    ).toBe(165)
  })
})
