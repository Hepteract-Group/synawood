/** Resolve, switch, and chip missing locale copy (ADR-0043). */

import { parseStudioProject, type StudioProject } from '../project/schema'
import {
  emptyLocalization,
  localeCopySchema,
  type LocaleCopy,
  type LocalizationSlice,
  type Localized,
} from './schema'

export const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur'])

export const localeTextDirection = (locale: string): 'ltr' | 'rtl' =>
  RTL_LOCALES.has(locale.split('-')[0] ?? locale) ? 'rtl' : 'ltr'

export const resolveLocalized = <T>(
  value: Localized<T> | T,
  locale: string,
  fallback = 'en',
): T => {
  if (value && typeof value === 'object' && value !== null && 'default' in value) {
    const loc = value as Localized<T>
    return loc.byLocale?.[locale] ?? loc.byLocale?.[fallback] ?? loc.default
  }
  return value as T
}

const overlayTextMap = (project: StudioProject): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const overlay of project.overlays) {
    if (overlay.text.trim()) out[overlay.id] = overlay.text
  }
  return out
}

const slideTextMap = (project: StudioProject): LocaleCopy['slides'] => {
  const out: LocaleCopy['slides'] = {}
  for (const slide of project.slideshow?.slides ?? []) {
    out[slide.id] = {
      ...(slide.headline?.trim() ? { headline: slide.headline } : {}),
      ...(slide.body?.trim() ? { body: slide.body } : {}),
    }
  }
  return out
}

export const captureLocaleCopy = (project: StudioProject): LocaleCopy =>
  localeCopySchema.parse({
    overlays: overlayTextMap(project),
    slides: slideTextMap(project),
    intent: {
      ...(project.intent.cta?.trim() ? { cta: project.intent.cta } : {}),
      ...(project.intent.goalNote?.trim() ? { goalNote: project.intent.goalNote } : {}),
    },
  })

/** Persist translated copy. When `applyToPreview` is true, also switch active locale onto the timeline. */
export const writeLocaleCopy = (
  project: StudioProject,
  input: {
    locale: string
    source: LocaleCopy
    translated: LocaleCopy
    applyToPreview: boolean
  },
): StudioProject => {
  const loc = project.localization ?? emptyLocalization()
  const localization: LocalizationSlice = {
    ...loc,
    ...(input.applyToPreview ? { activeLocale: input.locale } : {}),
    locales: Array.from(new Set([...loc.locales, input.locale])),
    copy: {
      ...loc.copy,
      [loc.defaultLocale]: input.source,
      [input.locale]: input.translated,
    },
  }
  const next = parseStudioProject({
    ...project,
    localization,
    revision: project.revision + 1,
  })
  if (!input.applyToPreview) return next
  return applyLocaleCopy(next, input.translated)
}

export const applyLocaleCopy = (project: StudioProject, copy: LocaleCopy): StudioProject => {
  const overlays = project.overlays.map((overlay) => {
    const text = copy.overlays[overlay.id]
    return typeof text === 'string' ? { ...overlay, text } : overlay
  })
  const slides = project.slideshow
    ? {
        ...project.slideshow,
        slides: project.slideshow.slides.map((slide) => {
          const patch = copy.slides[slide.id]
          if (!patch) return slide
          return {
            ...slide,
            headline: patch.headline ?? slide.headline,
            body: patch.body ?? slide.body,
          }
        }),
      }
    : project.slideshow
  const intent = {
    ...project.intent,
    ...(copy.intent?.cta != null ? { cta: copy.intent.cta } : {}),
    ...(copy.intent?.goalNote != null ? { goalNote: copy.intent.goalNote } : {}),
  }
  return parseStudioProject({
    ...project,
    overlays,
    slideshow: slides,
    intent,
  })
}

export const withLocalization = (
  project: StudioProject,
  localization: LocalizationSlice,
): StudioProject =>
  parseStudioProject({
    ...project,
    localization,
    revision: project.revision + 1,
  })

export type MissingTranslationChip = {
  key: string
  locale: string
  source: string
}

export const missingTranslationChips = (project: StudioProject): MissingTranslationChip[] => {
  const loc = project.localization ?? emptyLocalization()
  if (loc.activeLocale === loc.defaultLocale) return []
  const fallback = loc.copy[loc.defaultLocale] ?? captureLocaleCopy(project)
  const active = loc.copy[loc.activeLocale] ?? localeCopySchema.parse({})
  const chips: MissingTranslationChip[] = []
  for (const [id, text] of Object.entries(fallback.overlays)) {
    if (text.trim() && !active.overlays[id]?.trim()) {
      chips.push({ key: `overlay.${id}`, locale: loc.activeLocale, source: text.slice(0, 80) })
    }
  }
  for (const [id, slide] of Object.entries(fallback.slides)) {
    if (slide.headline?.trim() && !active.slides[id]?.headline?.trim()) {
      chips.push({
        key: `slide.${id}.headline`,
        locale: loc.activeLocale,
        source: slide.headline.slice(0, 80),
      })
    }
    if (slide.body?.trim() && !active.slides[id]?.body?.trim()) {
      chips.push({
        key: `slide.${id}.body`,
        locale: loc.activeLocale,
        source: slide.body.slice(0, 80),
      })
    }
  }
  if (fallback.intent?.cta?.trim() && !active.intent?.cta?.trim()) {
    chips.push({
      key: 'intent.cta',
      locale: loc.activeLocale,
      source: fallback.intent.cta.slice(0, 80),
    })
  }
  return chips
}

export const ensureLocaleListed = (
  localization: LocalizationSlice,
  locale: string,
): LocalizationSlice => {
  if (localization.locales.includes(locale)) return localization
  return {
    ...localization,
    locales: [...localization.locales, locale],
  }
}

/** Snapshot current strings into from-locale, apply to-locale (or default copy). */
export const switchProjectLocale = (project: StudioProject, locale: string): StudioProject => {
  const current = project.localization ?? emptyLocalization()
  if (current.activeLocale === locale && current.locales.includes(locale)) return project

  const snapshot = captureLocaleCopy(project)
  const listed = ensureLocaleListed(current, locale)
  const copy = {
    ...listed.copy,
    [listed.activeLocale]: snapshot,
  }
  const nextLoc: LocalizationSlice = {
    ...listed,
    copy,
    activeLocale: locale,
  }
  const target = copy[locale] ?? copy[listed.defaultLocale] ?? snapshot
  return applyLocaleCopy(
    parseStudioProject({ ...project, localization: nextLoc, revision: project.revision + 1 }),
    target,
  )
}

const NOTO_HINT = /noto/i
const LATIN_SAFE = new Set([
  'en',
  'fr',
  'de',
  'es',
  'it',
  'pt',
  'nl',
  'sv',
  'da',
  'no',
  'nb',
  'fi',
  'pl',
  'cs',
  'sk',
  'hu',
  'ro',
  'hr',
  'sl',
  'id',
  'ms',
  'tr',
  'vi',
])

export const fontFallbackWarning = (input: {
  locale: string
  fontFamily?: string
}): string | null => {
  const lang = input.locale.split('-')[0] ?? input.locale
  const needsNoto = RTL_LOCALES.has(lang) || !LATIN_SAFE.has(lang)
  if (!needsNoto) return null
  if (input.fontFamily && NOTO_HINT.test(input.fontFamily)) return null
  return `Locale ${input.locale} needs a Noto (or equivalent) font — current family may miss glyphs.`
}
