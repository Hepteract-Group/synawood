import { getFirstPartySticker } from './stickers'
import type { CaptionWord, OverlayStyle, StudioProject } from '../project/schema'
import { appendWhyLog, secondsAtFrame } from '../project/why-log'

const STOP = new Set([
  'a',
  'an',
  'and',
  'the',
  'to',
  'of',
  'in',
  'on',
  'for',
  'is',
  'it',
  'we',
  'i',
  'you',
])

const HOOK_LEXICON = new Set(['free', 'now', 'today', 'new', 'save', 'try', 'get', 'start'])

const stripWord = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '')

export type CaptionMark = { wordIndex: number; stickerId: string }
export type CaptionEmphasisHit = { wordIndex: number }

export type CaptionEmphasisPlan = {
  emphasis: CaptionEmphasisHit[]
  emoji: CaptionMark[]
}

const stickerForWord = (word: string): string => {
  if (/save|free|deal|offer/.test(word)) return 'sparkle'
  if (/now|today|new|start/.test(word)) return 'bolt'
  if (/easy|done|check/.test(word)) return 'check'
  if (/love|heart/.test(word)) return 'heart'
  return 'star'
}

export const planCaptionEmphasis = (input: {
  words: readonly { text: string }[]
  keywords: readonly string[]
  remainingMarks: number
}): CaptionEmphasisPlan => {
  const keys = input.keywords.map(stripWord).filter((item) => item.length >= 3)
  const emphasis: CaptionEmphasisHit[] = []
  const emoji: CaptionMark[] = []
  let marksLeft = Math.max(0, input.remainingMarks)

  input.words.forEach((word, wordIndex) => {
    const normalized = stripWord(word.text)
    if (!normalized || STOP.has(normalized)) return
    const keyed = keys.some(
      (key) => normalized === key || normalized.includes(key) || key.includes(normalized),
    )
    const hook = HOOK_LEXICON.has(normalized)
    if (!keyed && !hook) return
    if (emphasis.length < 2) emphasis.push({ wordIndex })
    if (marksLeft > 0 && emoji.length === 0) {
      const stickerId = stickerForWord(normalized)
      if (getFirstPartySticker(stickerId)) {
        emoji.push({ wordIndex, stickerId })
        marksLeft -= 1
      }
    }
  })

  return { emphasis, emoji }
}

const keywordsFromProject = (project: StudioProject): string[] => {
  const intent = project.intent
  const fromIntent = Array.isArray(intent?.keywords) ? intent.keywords : []
  const cta = typeof intent?.cta === 'string' ? intent.cta.split(/\s+/) : []
  const fromBrand =
    typeof project.brand?.defaultCta === 'string' ? project.brand.defaultCta.split(/\s+/) : []
  return [...fromIntent, ...cta, ...fromBrand]
}

export const applyCaptionEmphasis = (
  project: StudioProject,
  options?: { highlights?: boolean; marks?: boolean; overlayIds?: ReadonlySet<string> },
): StudioProject => {
  const doHighlights = options?.highlights !== false
  const doMarks = options?.marks !== false
  const captions = project.overlays
    .filter(
      (overlay) =>
        overlay.kind === 'caption' && (!options?.overlayIds || options.overlayIds.has(overlay.id)),
    )
    .slice()
    .sort((a, b) => a.from - b.from)
  if (captions.length === 0) return project
  const durationSeconds = project.durationFrames / Math.max(project.fps, 1)
  let remainingMarks = Math.max(1, Math.round(durationSeconds / 10))
  const keywords = keywordsFromProject(project)
  let next: StudioProject = project
  let highlighted = 0
  let marked = 0
  const overlays = next.overlays.map((overlay) => {
    if (overlay.kind !== 'caption') return overlay
    if (options?.overlayIds && !options.overlayIds.has(overlay.id)) return overlay
    const words: CaptionWord[] = overlay.words ?? []
    const tokens =
      words.length > 0
        ? words
        : overlay.text
            .split(/\s+/)
            .filter(Boolean)
            .map((text) => ({ text, startMs: 0, endMs: 1 }))
    const plan = planCaptionEmphasis({ words: tokens, keywords, remainingMarks })
    remainingMarks = Math.max(0, remainingMarks - plan.emoji.length)
    const emphasis = doHighlights ? plan.emphasis : (overlay.style?.emphasis ?? [])
    const emoji = doMarks ? plan.emoji : (overlay.style?.emoji ?? [])
    highlighted += doHighlights ? plan.emphasis.length : 0
    marked += doMarks ? plan.emoji.length : 0
    const style: OverlayStyle = {
      ...(overlay.style ?? {}),
      emphasis,
      emoji,
    }
    return { ...overlay, style }
  })
  next = { ...next, overlays }
  if (highlighted === 0 && marked === 0) return project
  const first = captions[0]!
  if (highlighted > 0) {
    next = appendWhyLog(next, {
      t: secondsAtFrame(next, first.from),
      target: first.id,
      action: 'caption',
      reason: 'Colored a keyword.',
    })
  }
  if (marked > 0) {
    next = appendWhyLog(next, {
      t: secondsAtFrame(next, first.from),
      target: first.id,
      action: 'caption',
      reason: 'Added a small mark after a keyword.',
    })
  }
  return next
}

export const setCaptionStyle = (
  project: StudioProject,
  input: {
    overlayId?: string
    karaoke?: boolean
    highlight?: boolean
    emoji?: boolean
  },
): StudioProject => {
  const targetIds = new Set(
    project.overlays
      .filter(
        (overlay) =>
          overlay.kind === 'caption' && (!input.overlayId || overlay.id === input.overlayId),
      )
      .map((overlay) => overlay.id),
  )
  if (targetIds.size === 0) {
    throw new Error('No captions to update.')
  }
  let next = project
  if (input.highlight === true && input.emoji === true) {
    next = applyCaptionEmphasis(next, { overlayIds: targetIds })
  } else if (input.highlight === true) {
    next = applyCaptionEmphasis(next, { marks: false, overlayIds: targetIds })
  } else if (input.emoji === true) {
    next = applyCaptionEmphasis(next, { highlights: false, overlayIds: targetIds })
  }
  const overlays = next.overlays.map((overlay) => {
    if (!targetIds.has(overlay.id)) return overlay
    const style: OverlayStyle = { ...(overlay.style ?? {}) }
    if (input.karaoke === true) {
      style.presetId = overlay.words && overlay.words.length > 0 ? 'karaoke' : 'band'
    }
    if (input.karaoke === false && style.presetId === 'karaoke') {
      style.presetId = 'band'
    }
    if (input.highlight === false) style.emphasis = []
    if (input.emoji === false) style.emoji = []
    return { ...overlay, style }
  })
  return { ...next, overlays, revision: next.revision + 1 }
}
