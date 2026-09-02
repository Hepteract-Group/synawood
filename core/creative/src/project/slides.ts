import { z } from 'zod'
import {
  getSlideshowPreset,
  slideshowPresetIdSchema,
  type SlideshowPreset,
  type SlideshowSafeMargins,
} from '../presets/slideshow'

export const slideTransitionSchema = z.enum(['cut', 'fade', 'kenBurns'])

export const OVERLAY_SLIDE_LAYOUTS = ['hero', 'point', 'stat', 'quote', 'cta'] as const
export const COMPARTMENT_SLIDE_LAYOUTS = [
  'stack_media_top',
  'stack_type_top',
  'split_media_left',
  'split_media_right',
] as const

/**
 * Visual layout template for a slide.
 * Overlay (type on a full-bleed photo):
 * - hero  : slide 1 hook — oversized headline, accent kicker bar, optional bg
 * - point : middle slides — numbered chip, headline + body panel on brand-tinted surface
 * - stat  : single large number/stat in accent, support line as body
 * - quote : large quote marks, italic serif headline, attribution as body
 * - cta   : full brand-primary fill, centered CTA, logo lockup center-bottom
 * Compartment (image and type in separate bands/columns — #1017):
 * - stack_media_top   : photo band on top, type on a solid field below
 * - stack_type_top    : type on a solid field, rounded image card below
 * - split_media_left  : image left, type right
 * - split_media_right : type left, image right
 */
export const slideLayoutIdSchema = z.enum([...OVERLAY_SLIDE_LAYOUTS, ...COMPARTMENT_SLIDE_LAYOUTS])
export const slideLayoutSchema = slideLayoutIdSchema.default('point')
export type SlideLayout = z.infer<typeof slideLayoutIdSchema>
export type OverlaySlideLayout = (typeof OVERLAY_SLIDE_LAYOUTS)[number]
export type CompartmentSlideLayout = (typeof COMPARTMENT_SLIDE_LAYOUTS)[number]

export const isCompartmentSlideLayout = (layout: SlideLayout): layout is CompartmentSlideLayout =>
  (COMPARTMENT_SLIDE_LAYOUTS as readonly string[]).includes(layout)

export const isOverlaySlideLayout = (layout: SlideLayout): layout is OverlaySlideLayout =>
  (OVERLAY_SLIDE_LAYOUTS as readonly string[]).includes(layout)

export const isStackedSlideLayout = (layout: SlideLayout): boolean =>
  layout === 'stack_media_top' || layout === 'stack_type_top'

export const isSplitSlideLayout = (layout: SlideLayout): boolean =>
  layout === 'split_media_left' || layout === 'split_media_right'

export const slideSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    /** Background: generated still, brand still, or solid/gradient from brand tokens. */
    backgroundAssetId: z.string().uuid().optional(),
    headline: z.string().default(''),
    body: z.string().optional(),
    /** MP4 timing; stills ignore but keep for VO sync. */
    durationFrames: z.number().int().positive(),
    transition: slideTransitionSchema.default('cut'),
    /** Visual layout template. */
    layout: slideLayoutSchema,
    /** Line spoken while this slide shows (optional). */
    voiceoverCue: z.string().optional(),
    /** Composition validates margins against the active preset. */
    textSafe: z.boolean().default(true),
  })
  .strict()

export const voiceoverModeSchema = z.enum(['none', 'per_slide', 'continuous'])

export const slideshowExtrasSchema = z
  .object({
    presetId: slideshowPresetIdSchema,
    slides: z.array(slideSchema).default([]),
    voiceoverAssetId: z.string().uuid().optional(),
    voiceoverMode: voiceoverModeSchema.default('none'),
    captionDraft: z.string().optional(),
    altTextDraft: z.string().optional(),
  })
  .strict()

export type Slide = z.infer<typeof slideSchema>
export type SlideshowExtras = z.infer<typeof slideshowExtrasSchema>
export type SlideTransition = z.infer<typeof slideTransitionSchema>
export type VoiceoverMode = z.infer<typeof voiceoverModeSchema>

/** Auto-assign layouts: first = hero, last = cta, middle by position pattern. */
export const assignLayouts = (slides: readonly Slide[]): Slide[] => {
  const n = slides.length
  if (n === 0) return []
  return slides.map((slide, i) => {
    let layout: SlideLayout
    if (i === 0) {
      layout = 'hero'
    } else if (i === n - 1 && n > 1) {
      layout = 'cta'
    } else {
      // Middle slides: mix overlay templates with stacked/split compartments (#1017).
      const patterns: SlideLayout[] = [
        'stack_media_top',
        'point',
        'split_media_left',
        'stat',
        'stack_type_top',
        'quote',
        'split_media_right',
      ]
      layout = patterns[(i - 1) % patterns.length]!
    }
    return { ...slide, layout }
  })
}

const wordCount = (text: string): number => {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export type SlideshowValidationIssue = {
  code:
    | 'slide_count'
    | 'headline_words'
    | 'headline_chars'
    | 'body_not_allowed'
    | 'body_words'
    | 'body_chars'
    | 'safe_margins'
    | 'order_gap'
    | 'duplicate_id'
  slideId?: string
  message: string
}

export type SlideshowValidationResult = {
  ok: boolean
  issues: SlideshowValidationIssue[]
}

/** Deterministic Path C overflow gate — word + char caps from the preset. */
export const validateHeadlineForPreset = (
  headline: string,
  preset: SlideshowPreset,
): SlideshowValidationIssue[] => {
  const issues: SlideshowValidationIssue[] = []
  const words = wordCount(headline)
  if (words > preset.headlineMaxWords) {
    issues.push({
      code: 'headline_words',
      message: `Headline has ${words} words; preset ${preset.id} allows ≤ ${preset.headlineMaxWords}`,
    })
  }
  if (headline.length > preset.headlineMaxChars) {
    issues.push({
      code: 'headline_chars',
      message: `Headline is ${headline.length} chars; preset ${preset.id} allows ≤ ${preset.headlineMaxChars}`,
    })
  }
  return issues
}

export const validateBodyForPreset = (
  body: string | undefined,
  preset: SlideshowPreset,
): SlideshowValidationIssue[] => {
  const issues: SlideshowValidationIssue[] = []
  const text = body?.trim() ?? ''
  if (!text) return issues
  if (!preset.bodyAllowed) {
    issues.push({
      code: 'body_not_allowed',
      message: `Preset ${preset.id} does not allow body copy on slides`,
    })
    return issues
  }
  const words = wordCount(text)
  if (words > preset.bodyMaxWords) {
    issues.push({
      code: 'body_words',
      message: `Body has ${words} words; preset ${preset.id} allows ≤ ${preset.bodyMaxWords}`,
    })
  }
  if (text.length > preset.bodyMaxChars) {
    issues.push({
      code: 'body_chars',
      message: `Body is ${text.length} chars; preset ${preset.id} allows ≤ ${preset.bodyMaxChars}`,
    })
  }
  return issues
}

/**
 * Safe-margin check for Path C chrome. `textSafe: false` on a slide fails;
 * optional explicit margins must stay inside the preset box.
 */
export const validateSafeMargins = (
  slide: Slide,
  preset: SlideshowPreset,
  usedMargins?: Partial<SlideshowSafeMargins>,
): SlideshowValidationIssue[] => {
  if (!slide.textSafe) {
    return [
      {
        code: 'safe_margins',
        slideId: slide.id,
        message: `Slide ${slide.id} marked textSafe=false (overflows preset safe margins)`,
      },
    ]
  }
  if (!usedMargins) return []
  const issues: SlideshowValidationIssue[] = []
  const keys = ['top', 'right', 'bottom', 'left'] as const
  for (const key of keys) {
    const used = usedMargins[key]
    if (typeof used !== 'number') continue
    if (used < preset.safeMargins[key]) {
      issues.push({
        code: 'safe_margins',
        slideId: slide.id,
        message: `Slide ${slide.id} ${key} margin ${used}px is inside reserved ${preset.safeMargins[key]}px safe zone`,
      })
    }
  }
  return issues
}

/** Full pack validation against the channel preset (count, copy, order, margins). */
export const validateSlideshow = (extras: SlideshowExtras): SlideshowValidationResult => {
  const preset = getSlideshowPreset(extras.presetId)
  const issues: SlideshowValidationIssue[] = []
  const count = extras.slides.length

  if (count < preset.slideCount.min || count > preset.slideCount.max) {
    issues.push({
      code: 'slide_count',
      message: `Slide count ${count} outside ${preset.id} range ${preset.slideCount.min}–${preset.slideCount.max}`,
    })
  }

  const ids = new Set<string>()
  const orders = extras.slides.map((slide) => slide.order).sort((a, b) => a - b)
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i) {
      issues.push({
        code: 'order_gap',
        message: `Slide order must be contiguous from 0; got [${orders.join(', ')}]`,
      })
      break
    }
  }

  for (const slide of extras.slides) {
    if (ids.has(slide.id)) {
      issues.push({
        code: 'duplicate_id',
        slideId: slide.id,
        message: `Duplicate slide id ${slide.id}`,
      })
    }
    ids.add(slide.id)

    for (const issue of validateHeadlineForPreset(slide.headline, preset)) {
      issues.push({ ...issue, slideId: slide.id })
    }
    for (const issue of validateBodyForPreset(slide.body, preset)) {
      issues.push({ ...issue, slideId: slide.id })
    }
    for (const issue of validateSafeMargins(slide, preset)) {
      issues.push(issue)
    }
  }

  return { ok: issues.length === 0, issues }
}

export const emptySlideshowExtras = (presetId: SlideshowExtras['presetId']): SlideshowExtras =>
  slideshowExtrasSchema.parse({
    presetId,
    slides: [],
    voiceoverMode: 'none',
  })

/** Build N empty slides with preset default timing (for plan_slideshow later). */
export const draftSlides = (input: {
  presetId: SlideshowExtras['presetId']
  count?: number
  headlines?: string[]
}): Slide[] => {
  const preset = getSlideshowPreset(input.presetId)
  const requested =
    input.count ??
    (input.headlines && input.headlines.length > 0
      ? input.headlines.length
      : preset.slideCount.default)
  const count = Math.min(preset.slideCount.max, Math.max(preset.slideCount.min, requested))
  const headlines = input.headlines ?? []
  const raw = Array.from({ length: count }, (_, order) =>
    slideSchema.parse({
      id: `slide_${order + 1}`,
      order,
      headline: headlines[order] ?? '',
      durationFrames: preset.defaultSlideDurationFrames,
      transition: 'cut',
      layout: 'point',
      textSafe: true,
    }),
  )
  return assignLayouts(raw)
}
