import type { StudioProject } from './schema'
import { COMPOSITION_DISPLAY, isCampaignPackComposition, isSlideshowComposition } from './schema'
import {
  draftSlides,
  emptySlideshowExtras,
  slideSchema,
  slideshowExtrasSchema,
  validateSlideshow,
  type Slide,
  type SlideLayout,
  type SlideTransition,
  type SlideshowExtras,
} from './slides'
import type { SlideshowPresetId } from '../presets/slideshow'
import { getSlideshowPreset } from '../presets/slideshow'

const nextRevision = (project: StudioProject): number => project.revision + 1

const asSlideshowProject = (
  project: StudioProject,
  presetId?: SlideshowPresetId,
): StudioProject => {
  if (isSlideshowComposition(project.compositionId) && project.slideshow) {
    return project
  }
  if (isCampaignPackComposition(project.compositionId)) {
    const current = COMPOSITION_DISPLAY[project.compositionId]?.label ?? 'this format'
    throw new Error(
      `This project is a ${current} — slideshow tools need an Instagram Carousel or Vertical Slideshow. Create one of those, or start from Video Suite.`,
    )
  }
  const resolvedPresetId =
    presetId ?? (project.height >= project.width ? 'tiktok_slideshow_9x16' : 'ig_carousel_1080')
  const channel = getSlideshowPreset(resolvedPresetId)
  return {
    ...project,
    compositionId: channel.compositionId,
    width: channel.width,
    height: channel.height,
    fps: channel.fps,
    slideshow: emptySlideshowExtras(resolvedPresetId),
  }
}

const requireSlideshow = (project: StudioProject): SlideshowExtras => {
  if (!isSlideshowComposition(project.compositionId) || !project.slideshow) {
    throw new Error('Plan slides first so this project is a carousel or vertical slideshow.')
  }
  return project.slideshow
}

const withSlideshow = (
  project: StudioProject,
  slideshow: SlideshowExtras,
  durationFrames?: number,
): StudioProject => {
  const parsed = slideshowExtrasSchema.parse(slideshow)
  const gate = validateSlideshow(parsed)
  if (!gate.ok) {
    throw new Error(gate.issues.map((issue) => issue.message).join('; '))
  }
  const slideTotal = parsed.slides.reduce((sum, slide) => sum + slide.durationFrames, 0)
  return {
    ...project,
    slideshow: parsed,
    durationFrames: durationFrames ?? Math.max(slideTotal, 1),
    revision: nextRevision(project),
  }
}

export type PlanSlideshowInput = {
  headlines?: string[]
  count?: number
  presetId?: SlideshowPresetId
}

/** Replace slides[] from an outline (agent plan_slideshow). */
export const planSlideshow = (project: StudioProject, input: PlanSlideshowInput): StudioProject => {
  const base = asSlideshowProject(project, input.presetId)
  const current = base.slideshow
  if (!current) {
    throw new Error('Project is missing slideshow extras')
  }
  const presetId = input.presetId ?? current.presetId
  const channel = getSlideshowPreset(presetId)
  if (channel.compositionId !== base.compositionId) {
    throw new Error(
      `Preset ${presetId} targets ${channel.compositionId}, not ${base.compositionId}`,
    )
  }
  const slides = draftSlides({
    presetId,
    count: input.count,
    headlines: input.headlines,
  })
  return withSlideshow(base, {
    ...current,
    presetId,
    slides,
  })
}

export type SetSlidePatch = {
  headline?: string
  body?: string | null
  durationFrames?: number
  transition?: SlideTransition
  layout?: SlideLayout
  backgroundAssetId?: string | null
  voiceoverCue?: string | null
  textSafe?: boolean
}

/** Patch one slide by id. */
export const setSlide = (
  project: StudioProject,
  input: { slideId: string; patch: SetSlidePatch },
): StudioProject => {
  const current = requireSlideshow(project)
  const index = current.slides.findIndex((slide) => slide.id === input.slideId)
  if (index < 0) {
    throw new Error(`Unknown slide ${input.slideId}`)
  }
  const existing = current.slides[index]!
  const patch = input.patch
  const next: Slide = slideSchema.parse({
    ...existing,
    headline: patch.headline ?? existing.headline,
    body: patch.body === null ? undefined : patch.body !== undefined ? patch.body : existing.body,
    durationFrames: patch.durationFrames ?? existing.durationFrames,
    transition: patch.transition ?? existing.transition,
    layout: patch.layout ?? existing.layout,
    backgroundAssetId:
      patch.backgroundAssetId === null
        ? undefined
        : patch.backgroundAssetId !== undefined
          ? patch.backgroundAssetId
          : existing.backgroundAssetId,
    voiceoverCue:
      patch.voiceoverCue === null
        ? undefined
        : patch.voiceoverCue !== undefined
          ? patch.voiceoverCue
          : existing.voiceoverCue,
    textSafe: patch.textSafe ?? existing.textSafe,
  })
  const slides = current.slides.map((slide, i) => (i === index ? next : slide))
  return withSlideshow(project, { ...current, slides })
}

/** Reorder slides to match orderedIds (must be a permutation of current ids). */
export const reorderSlides = (
  project: StudioProject,
  input: { orderedIds: string[] },
): StudioProject => {
  const current = requireSlideshow(project)
  if (input.orderedIds.length !== current.slides.length) {
    throw new Error(
      `orderedIds length ${input.orderedIds.length} does not match slide count ${current.slides.length}`,
    )
  }
  const byId = new Map(current.slides.map((slide) => [slide.id, slide]))
  const seen = new Set<string>()
  const slides: Slide[] = input.orderedIds.map((id, order) => {
    const slide = byId.get(id)
    if (!slide) throw new Error(`Unknown slide ${id}`)
    if (seen.has(id)) throw new Error(`Duplicate slide id ${id} in orderedIds`)
    seen.add(id)
    return { ...slide, order }
  })
  return withSlideshow(project, { ...current, slides })
}

const nextSlideId = (slides: readonly Slide[]): string => {
  const ids = new Set(slides.map((slide) => slide.id))
  let n = slides.length + 1
  while (ids.has(`slide_${n}`)) n += 1
  return `slide_${n}`
}

const renumberOrders = (slides: readonly Slide[]): Slide[] =>
  slides.map((slide, order) => ({ ...slide, order }))

const slideTotalFrames = (slides: readonly Slide[]): number =>
  Math.max(
    1,
    slides.reduce((sum, slide) => sum + slide.durationFrames, 0),
  )

export type AddSlideInput = {
  /** Insert after this slide; omit to append at end. Ignored when pack is empty. */
  afterSlideId?: string
  headline?: string
}

/**
 * Add one blank slide (or seed the default pack when empty).
 * Respects preset max; empty pack → draftSlides at preset default count.
 */
export const addSlide = (project: StudioProject, input: AddSlideInput = {}): StudioProject => {
  const current = requireSlideshow(project)
  const preset = getSlideshowPreset(current.presetId)

  if (current.slides.length === 0) {
    const slides = draftSlides({ presetId: current.presetId })
    return withSlideshow(project, { ...current, slides }, slideTotalFrames(slides))
  }

  if (current.slides.length >= preset.slideCount.max) {
    throw new Error(
      `This format allows at most ${preset.slideCount.max} slides — remove one before adding.`,
    )
  }

  const sorted = [...current.slides].sort((a, b) => a.order - b.order)
  let insertAt = sorted.length
  if (input.afterSlideId) {
    const idx = sorted.findIndex((slide) => slide.id === input.afterSlideId)
    if (idx < 0) throw new Error(`Unknown slide ${input.afterSlideId}`)
    insertAt = idx + 1
  }

  const layout: SlideLayout = insertAt === 0 ? 'hero' : insertAt === sorted.length ? 'cta' : 'point'

  const fresh = slideSchema.parse({
    id: nextSlideId(sorted),
    order: insertAt,
    headline: input.headline ?? '',
    durationFrames: preset.defaultSlideDurationFrames,
    transition: 'cut',
    layout,
    textSafe: true,
  })

  const next = [...sorted]
  next.splice(insertAt, 0, fresh)
  const slides = renumberOrders(next)
  return withSlideshow(project, { ...current, slides }, slideTotalFrames(slides))
}

/** Remove one slide by id. Refuses when at preset minimum. */
export const removeSlide = (project: StudioProject, input: { slideId: string }): StudioProject => {
  const current = requireSlideshow(project)
  const preset = getSlideshowPreset(current.presetId)

  if (current.slides.length <= preset.slideCount.min) {
    throw new Error(
      `This format needs at least ${preset.slideCount.min} slides — cannot remove more.`,
    )
  }

  if (!current.slides.some((slide) => slide.id === input.slideId)) {
    throw new Error(`Unknown slide ${input.slideId}`)
  }

  const slides = renumberOrders(
    [...current.slides]
      .sort((a, b) => a.order - b.order)
      .filter((slide) => slide.id !== input.slideId),
  )
  return withSlideshow(project, { ...current, slides }, slideTotalFrames(slides))
}

/** Attach a generated/uploaded still as the background for one slide. */
export const setSlideBackground = (
  project: StudioProject,
  input: { slideId: string; backgroundAssetId: string },
): StudioProject =>
  setSlide(project, {
    slideId: input.slideId,
    patch: { backgroundAssetId: input.backgroundAssetId },
  })

/** Attach a voiceover asset and mode on the slideshow extras. */
export const setSlideshowVoiceover = (
  project: StudioProject,
  input: {
    voiceoverAssetId?: string | null
    voiceoverMode?: SlideshowExtras['voiceoverMode']
  },
): StudioProject => {
  const current = requireSlideshow(project)
  return withSlideshow(project, {
    ...current,
    voiceoverAssetId:
      input.voiceoverAssetId === null
        ? undefined
        : input.voiceoverAssetId !== undefined
          ? input.voiceoverAssetId
          : current.voiceoverAssetId,
    voiceoverMode: input.voiceoverMode ?? current.voiceoverMode,
  })
}
