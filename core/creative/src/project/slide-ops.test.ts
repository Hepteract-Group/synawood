import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './schema'
import { addSlide, planSlideshow, removeSlide, reorderSlides, setSlide } from './slide-ops'
import { assignLayouts } from './slides'
import type { Slide } from './slides'

describe('slide-ops', () => {
  const slideshowProject = () =>
    createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })

  it('plans slides from headlines and validates count', () => {
    const next = planSlideshow(slideshowProject(), {
      headlines: ['Hook', 'Problem', 'Proof', 'Product', 'CTA'],
    })
    expect(next.slideshow?.slides).toHaveLength(5)
    expect(next.slideshow?.slides[0]?.headline).toBe('Hook')
    expect(next.revision).toBe(2)
    expect(next.durationFrames).toBe(5 * 90)
    expect(next.durationFrames).toBeLessThan(slideshowProject().durationFrames)
  })

  it('converts a Video Suite project so slides land on this player', () => {
    const project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'talking-head-60',
    })
    const next = planSlideshow(project, { count: 5 })
    expect(next.compositionId).toBe('vertical-slideshow')
    expect(next.slideshow?.slides).toHaveLength(5)
    expect(next.width).toBe(1080)
    expect(next.height).toBe(1920)
  })

  it('honors a square carousel preset when converting', () => {
    const project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'talking-head-60',
    })
    const next = planSlideshow(project, {
      headlines: ['Hook', 'Proof', 'CTA'],
      presetId: 'linkedin_carousel_1080',
    })
    expect(next.compositionId).toBe('social-carousel')
    expect(next.slideshow?.slides).toHaveLength(3)
    expect(next.width).toBe(1080)
    expect(next.height).toBe(1080)
  })

  it('still refuses slideshow tools on a Campaign Pack', () => {
    const project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'campaign-pack-still',
    })
    expect(() => planSlideshow(project, { count: 5 })).toThrow(/Campaign Pack/)
  })

  it('sets a slide headline and reorders', () => {
    let project = planSlideshow(slideshowProject(), {
      headlines: ['A', 'B', 'C'],
    })
    const ids = project.slideshow!.slides.map((slide) => slide.id)
    project = setSlide(project, { slideId: ids[1]!, patch: { headline: 'Better B' } })
    expect(project.slideshow!.slides.find((s) => s.id === ids[1]!)?.headline).toBe('Better B')

    project = reorderSlides(project, { orderedIds: [ids[2]!, ids[0]!, ids[1]!] })
    expect(project.slideshow!.slides.map((s) => s.headline)).toEqual(['C', 'A', 'Better B'])
    expect(project.slideshow!.slides.map((s) => s.order)).toEqual([0, 1, 2])
  })

  it('auto-assigns hero to slide 1 and cta to last slide via draftSlides', () => {
    const project = planSlideshow(slideshowProject(), {
      headlines: ['Hook', 'Point 1', 'Stat', 'Quote', 'CTA'],
    })
    const slides = project.slideshow!.slides.slice().sort((a, b) => a.order - b.order)
    expect(slides[0]?.layout).toBe('hero')
    expect(slides[slides.length - 1]?.layout).toBe('cta')
    for (const slide of slides.slice(1, -1)) {
      expect(['hero', 'cta']).not.toContain(slide.layout)
    }
    expect(slides.map((slide) => slide.layout).some((layout) => layout.startsWith('stack_'))).toBe(
      true,
    )
    expect(slides.map((slide) => slide.layout).some((layout) => layout.startsWith('split_'))).toBe(
      true,
    )
  })

  it('set_slide can override layout for a middle slide', () => {
    const project = planSlideshow(slideshowProject(), {
      headlines: ['Hook', '3× faster adoption', 'CTA'],
    })
    const statSlide = project.slideshow!.slides.find((s) => s.order === 1)!
    const updated = setSlide(project, { slideId: statSlide.id, patch: { layout: 'stat' } })
    expect(updated.slideshow!.slides.find((s) => s.id === statSlide.id)?.layout).toBe('stat')
    const stacked = setSlide(project, {
      slideId: statSlide.id,
      patch: { layout: 'stack_type_top' },
    })
    expect(stacked.slideshow!.slides.find((s) => s.id === statSlide.id)?.layout).toBe(
      'stack_type_top',
    )
  })

  it('assignLayouts: single slide is hero (no cta — insufficient count)', () => {
    const base: Slide = {
      id: 'slide_1',
      order: 0,
      headline: 'Only slide',
      durationFrames: 90,
      transition: 'cut',
      layout: 'point',
      textSafe: true,
    }
    const result = assignLayouts([base])
    expect(result[0]?.layout).toBe('hero')
  })

  it('assignLayouts: two slides — hero then cta', () => {
    const make = (order: number): Slide => ({
      id: `slide_${order + 1}`,
      order,
      headline: '',
      durationFrames: 90,
      transition: 'cut',
      layout: 'point',
      textSafe: true,
    })
    const result = assignLayouts([make(0), make(1)])
    expect(result[0]?.layout).toBe('hero')
    expect(result[1]?.layout).toBe('cta')
  })

  it('adds a slide after a target and refuses above max', () => {
    let project = planSlideshow(slideshowProject(), {
      headlines: ['A', 'B', 'C'],
    })
    const afterId = project.slideshow!.slides.find((s) => s.order === 0)!.id
    project = addSlide(project, { afterSlideId: afterId, headline: 'Inserted' })
    const headlines = project
      .slideshow!.slides.slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => s.headline)
    expect(headlines).toEqual(['A', 'Inserted', 'B', 'C'])

    // ig_carousel max = 10
    project = planSlideshow(slideshowProject(), {
      headlines: Array.from({ length: 10 }, (_, i) => `S${i + 1}`),
    })
    expect(() => addSlide(project, {})).toThrow(/at most 10/)
  })

  it('seeds default pack when adding to an empty slideshow', () => {
    const project = addSlide(slideshowProject(), {})
    expect(project.slideshow!.slides.length).toBeGreaterThanOrEqual(3)
  })

  it('removes a slide and refuses at preset minimum', () => {
    let project = planSlideshow(slideshowProject(), {
      headlines: ['A', 'B', 'C', 'D'],
    })
    const removeId = project.slideshow!.slides.find((s) => s.order === 1)!.id
    project = removeSlide(project, { slideId: removeId })
    expect(project.slideshow!.slides).toHaveLength(3)
    expect(project.slideshow!.slides.map((s) => s.order)).toEqual([0, 1, 2])

    // ig_carousel min = 3
    expect(() => removeSlide(project, { slideId: project.slideshow!.slides[0]!.id })).toThrow(
      /at least 3/,
    )
  })

  it('rejects headline overflow on setSlide', () => {
    const project = planSlideshow(slideshowProject(), {
      headlines: ['A', 'B', 'C'],
    })
    const id = project.slideshow!.slides[0]!.id
    expect(() =>
      setSlide(project, {
        slideId: id,
        patch: {
          headline: 'one two three four five six seven eight nine ten eleven twelve thirteen',
        },
      }),
    ).toThrow(/words/)
  })
})
