import { z } from 'zod'

/** Channel format presets for slideshow / carousel packs (not Remotion composition ids). */
export const SLIDESHOW_PRESET_IDS = [
  'ig_carousel_1080',
  'tiktok_slideshow_9x16',
  'ig_story_9x16',
  'linkedin_carousel_1080',
] as const

export type SlideshowPresetId = (typeof SLIDESHOW_PRESET_IDS)[number]

export type SlideshowSafeMargins = {
  top: number
  right: number
  bottom: number
  left: number
}

export type SlideshowPreset = {
  id: SlideshowPresetId
  label: string
  /** Linked Remotion composition for this channel format. */
  compositionId: 'social-carousel' | 'vertical-slideshow'
  aspect: '1:1' | '4:5' | '9:16'
  width: number
  height: number
  fps: number
  slideCount: { min: number; max: number; default: number }
  /** Soft max words for Path C headline (overflow gate). */
  headlineMaxWords: number
  /** Hard char cap for layout probe. */
  headlineMaxChars: number
  /** Body allowed (LinkedIn denser); others optional/short. */
  bodyAllowed: boolean
  bodyMaxWords: number
  bodyMaxChars: number
  /** Safe margins in px — platform UI chrome. */
  safeMargins: SlideshowSafeMargins
  /** Default duration per slide when planning MP4 timing. */
  defaultSlideDurationFrames: number
}

export const slideshowPresetIdSchema = z.enum(SLIDESHOW_PRESET_IDS)

export const SLIDESHOW_PRESETS: Record<SlideshowPresetId, SlideshowPreset> = {
  ig_carousel_1080: {
    id: 'ig_carousel_1080',
    label: 'Instagram carousel 1080',
    compositionId: 'social-carousel',
    aspect: '1:1',
    width: 1080,
    height: 1080,
    fps: 30,
    slideCount: { min: 3, max: 10, default: 6 },
    headlineMaxWords: 12,
    headlineMaxChars: 72,
    bodyAllowed: true,
    bodyMaxWords: 28,
    bodyMaxChars: 160,
    safeMargins: { top: 64, right: 64, bottom: 64, left: 64 },
    defaultSlideDurationFrames: 90,
  },
  tiktok_slideshow_9x16: {
    id: 'tiktok_slideshow_9x16',
    label: 'TikTok / Reels slideshow 9:16',
    compositionId: 'vertical-slideshow',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    slideCount: { min: 3, max: 8, default: 5 },
    headlineMaxWords: 10,
    headlineMaxChars: 60,
    bodyAllowed: false,
    bodyMaxWords: 0,
    bodyMaxChars: 0,
    // Extra bottom/top for TikTok UI chrome
    safeMargins: { top: 160, right: 48, bottom: 220, left: 48 },
    defaultSlideDurationFrames: 75,
  },
  ig_story_9x16: {
    id: 'ig_story_9x16',
    label: 'Instagram Story 9:16',
    compositionId: 'vertical-slideshow',
    aspect: '9:16',
    width: 1080,
    height: 1920,
    fps: 30,
    slideCount: { min: 1, max: 5, default: 3 },
    headlineMaxWords: 8,
    headlineMaxChars: 48,
    bodyAllowed: false,
    bodyMaxWords: 0,
    bodyMaxChars: 0,
    safeMargins: { top: 180, right: 48, bottom: 200, left: 48 },
    defaultSlideDurationFrames: 90,
  },
  linkedin_carousel_1080: {
    id: 'linkedin_carousel_1080',
    label: 'LinkedIn carousel 1080',
    compositionId: 'social-carousel',
    aspect: '1:1',
    width: 1080,
    height: 1080,
    fps: 30,
    slideCount: { min: 3, max: 8, default: 5 },
    headlineMaxWords: 14,
    headlineMaxChars: 90,
    bodyAllowed: true,
    bodyMaxWords: 40,
    bodyMaxChars: 220,
    safeMargins: { top: 56, right: 56, bottom: 56, left: 56 },
    defaultSlideDurationFrames: 90,
  },
}

export const getSlideshowPreset = (id: string): SlideshowPreset => {
  if (!(id in SLIDESHOW_PRESETS)) {
    throw new Error(`Unknown slideshow preset: ${id}`)
  }
  return SLIDESHOW_PRESETS[id as SlideshowPresetId]
}

export const isSlideshowPresetId = (id: string): id is SlideshowPresetId =>
  (SLIDESHOW_PRESET_IDS as readonly string[]).includes(id)
