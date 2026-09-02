import { describe, expect, it } from 'vitest'
import { getSlideshowPreset, SLIDESHOW_PRESETS } from '../presets/slideshow'
import {
  assignLayouts,
  COMPARTMENT_SLIDE_LAYOUTS,
  draftSlides,
  emptySlideshowExtras,
  isCompartmentSlideLayout,
  isOverlaySlideLayout,
  OVERLAY_SLIDE_LAYOUTS,
  slideLayoutSchema,
  validateSlideshow,
} from './slides'
import { createEmptyProject, parseStudioProject } from './schema'
import { randomUUID } from 'node:crypto'

describe('slideshow presets', () => {
  it('ships required Plan 04 presets', () => {
    expect(SLIDESHOW_PRESETS.ig_carousel_1080.compositionId).toBe('social-carousel')
    expect(SLIDESHOW_PRESETS.tiktok_slideshow_9x16.compositionId).toBe('vertical-slideshow')
    expect(getSlideshowPreset('ig_carousel_1080').slideCount.min).toBe(3)
  })
})

describe('slides domain', () => {
  it('creates empty slideshow extras on social-carousel projects', () => {
    const project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    expect(project.width).toBe(1080)
    expect(project.height).toBe(1080)
    expect(project.slideshow?.presetId).toBe('ig_carousel_1080')
    expect(project.slideshow?.slides).toEqual([])
  })

  it('round-trips slideshow JSONB on parseStudioProject', () => {
    const slides = draftSlides({
      presetId: 'tiktok_slideshow_9x16',
      headlines: ['Edit PDFs without Adobe', 'Open in your browser', 'Share in one tap'],
    })
    const project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'vertical-slideshow',
      slideshowPresetId: 'tiktok_slideshow_9x16',
    })
    const withSlides = parseStudioProject({
      ...project,
      slideshow: {
        ...emptySlideshowExtras('tiktok_slideshow_9x16'),
        slides,
      },
    })
    expect(withSlides.slideshow?.slides).toHaveLength(3)
    expect(withSlides.compositionId).toBe('vertical-slideshow')
  })

  it('validates slide count, headline overflow, and contiguous order', () => {
    const tooFew = validateSlideshow({
      presetId: 'ig_carousel_1080',
      slides: draftSlides({ presetId: 'ig_carousel_1080', count: 3 }).slice(0, 2),
      voiceoverMode: 'none',
    })
    expect(tooFew.ok).toBe(false)
    expect(tooFew.issues.some((issue) => issue.code === 'slide_count')).toBe(true)

    const longHeadline = draftSlides({ presetId: 'ig_carousel_1080', count: 3 })
    longHeadline[0] = {
      ...longHeadline[0]!,
      headline: 'one two three four five six seven eight nine ten eleven twelve thirteen',
    }
    const overflow = validateSlideshow({
      presetId: 'ig_carousel_1080',
      slides: longHeadline,
      voiceoverMode: 'none',
    })
    expect(overflow.ok).toBe(false)
    expect(overflow.issues.some((issue) => issue.code === 'headline_words')).toBe(true)

    const ok = validateSlideshow({
      presetId: 'ig_carousel_1080',
      slides: draftSlides({
        presetId: 'ig_carousel_1080',
        count: 5,
        headlines: ['A', 'B', 'C', 'D', 'E'],
      }),
      voiceoverMode: 'none',
    })
    expect(ok).toEqual({ ok: true, issues: [] })
  })

  it('rejects body copy on TikTok preset', () => {
    const slides = draftSlides({ presetId: 'tiktok_slideshow_9x16', count: 3 })
    slides[0] = { ...slides[0]!, body: 'This should not be allowed on TikTok slides' }
    const result = validateSlideshow({
      presetId: 'tiktok_slideshow_9x16',
      slides,
      voiceoverMode: 'none',
    })
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'body_not_allowed')).toBe(true)
  })

  it('flags textSafe=false as safe-margin failure', () => {
    const slides = draftSlides({ presetId: 'ig_carousel_1080', count: 3 })
    slides[1] = { ...slides[1]!, textSafe: false }
    const result = validateSlideshow({
      presetId: 'ig_carousel_1080',
      slides,
      voiceoverMode: 'none',
    })
    expect(result.issues.some((issue) => issue.code === 'safe_margins')).toBe(true)
  })

  it('accepts legacy underscore composition ids', () => {
    const project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'vertical-slideshow',
    })
    const again = parseStudioProject({ ...project, compositionId: 'vertical_slideshow' })
    expect(again.compositionId).toBe('vertical-slideshow')
  })

  it('accepts stacked and split compartment layouts (#1017)', () => {
    expect(slideLayoutSchema.parse('stack_media_top')).toBe('stack_media_top')
    expect(slideLayoutSchema.parse('stack_type_top')).toBe('stack_type_top')
    expect(slideLayoutSchema.parse('split_media_left')).toBe('split_media_left')
    expect(slideLayoutSchema.parse('split_media_right')).toBe('split_media_right')
    expect(COMPARTMENT_SLIDE_LAYOUTS).toEqual([
      'stack_media_top',
      'stack_type_top',
      'split_media_left',
      'split_media_right',
    ])
    expect(OVERLAY_SLIDE_LAYOUTS).toContain('hero')
    expect(isCompartmentSlideLayout('hero')).toBe(false)
    expect(isCompartmentSlideLayout('split_media_left')).toBe(true)
  })

  it('mixes overlay, stacked, and split on a 5-slide pack (#1017)', () => {
    const slides = draftSlides({
      presetId: 'linkedin_carousel_1080',
      headlines: ['Hook', 'Proof', 'How', 'Roadmap', 'CTA'],
    })
    const layouts = assignLayouts(slides).map((slide) => slide.layout)
    expect(layouts[0]).toBe('hero')
    expect(layouts.at(-1)).toBe('cta')
    expect(
      layouts.some((layout) => isCompartmentSlideLayout(layout) && layout.startsWith('stack_')),
    ).toBe(true)
    expect(layouts.some((layout) => layout.startsWith('split_'))).toBe(true)
    expect(layouts.some((layout) => isOverlaySlideLayout(layout))).toBe(true)
  })
})
