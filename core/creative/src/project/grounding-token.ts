/**
 * Pure `@t:` / `@clip:` / `@overlay:` helpers — no Node or schema imports.
 * Safe for client composer chips and server/agent resolution.
 */

import { assetLabel, type AssetRefLike } from './asset-token'

export type ClipRefLike = {
  id: string
  assetId: string
}

export type OverlayRefLike = {
  id: string
  kind: string
  text?: string
}

export type ChatGroundingPayload = {
  tSeconds?: number
  clipId?: string
  overlayId?: string
}

export type GroundingChip = {
  kind: 'time' | 'clip' | 'overlay'
  token: string
  label: string
  start: number
  end: number
}

export type ImplicitChatGrounding = {
  clipId?: string | null
  overlayId?: string | null
}

export type ResolvedChatGrounding = {
  payload: ChatGroundingPayload
  chips: GroundingChip[]
  /** Set when a typed token cannot be resolved. Do not send the turn. */
  error?: string
}

const TIME_TOKEN = /@t:([0-9]+(?::[0-9]{1,2})?(?:\.[0-9]+)?)/g
const CLIP_TOKEN = /@clip:([a-zA-Z0-9][^\s@]*)/g
const OVERLAY_TOKEN = /@overlay:([a-zA-Z0-9][^\s@]*)/g

const OVERLAY_KIND_LABEL: Record<string, string> = {
  hook_title: 'Hook title',
  end_card: 'End card',
  lower_third: 'Lower third',
  title: 'Title',
  caption: 'Caption',
  sticker: 'Sticker',
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

export const overlayLabel = (overlay: OverlayRefLike): string => {
  const text = overlay.text?.trim()
  if (text) return text.length > 40 ? `${text.slice(0, 37)}…` : text
  return OVERLAY_KIND_LABEL[overlay.kind] ?? overlay.kind.replaceAll('_', ' ')
}

export const clipLabel = (clip: ClipRefLike, assets: readonly AssetRefLike[]): string => {
  const asset = assets.find((item) => item.id === clip.assetId)
  if (asset) return assetLabel(asset)
  return 'Clip'
}

export const clipTokenFor = (clip: ClipRefLike, assets: readonly AssetRefLike[] = []): string => {
  const slug = slugify(clipLabel(clip, assets))
  const id8 = clip.id.replace(/^clip_/i, '').slice(0, 8)
  return slug ? `@clip:${slug}-${id8}` : `@clip:${clip.id}`
}

export const overlayTokenFor = (overlay: OverlayRefLike): string => {
  const slug = slugify(overlayLabel(overlay))
  const id8 = overlay.id.replace(/^overlay_/i, '').slice(0, 8)
  return slug ? `@overlay:${slug}-${id8}` : `@overlay:${overlay.id}`
}

const parseTimeBody = (raw: string): number | null => {
  const colon = /^(\d+):(\d{1,2})(?:\.(\d+))?$/.exec(raw)
  if (colon) {
    const minutes = Number(colon[1])
    const seconds = Number(colon[2])
    if (seconds >= 60) return null
    const frac = colon[3] ? Number(`0.${colon[3]}`) : 0
    return minutes * 60 + seconds + frac
  }
  const plain = /^(\d+)(?:\.(\d+))?$/.exec(raw)
  if (!plain) return null
  const frac = plain[2] ? Number(`0.${plain[2]}`) : 0
  return Number(plain[1]) + frac
}

export const formatTimeChipLabel = (seconds: number): string => {
  const safe = Math.max(0, seconds)
  const whole = Math.floor(safe)
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return `@ ${minutes}:${String(rest).padStart(2, '0')}`
}

/** Insertable playhead token, e.g. `@t:00:12`. */
export const formatTimeToken = (seconds: number): string => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const whole = Math.floor(safe)
  const frac = safe - whole
  if (frac >= 0.05 && whole < 60) {
    return `@t:${safe.toFixed(1).replace(/\.0$/, '')}`
  }
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return `@t:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

const findByTokenBody = <T extends { id: string }>(
  raw: string,
  items: readonly T[],
  tokenFor: (item: T) => string,
  prefix: string,
): T | undefined => {
  const needle = raw.toLowerCase()
  const exact = items.find((item) => tokenFor(item).slice(prefix.length).toLowerCase() === needle)
  if (exact) return exact

  const byId = items.find(
    (item) => item.id.toLowerCase() === needle || item.id.toLowerCase() === `${prefix}${needle}`,
  )
  if (byId) return byId

  if (needle.length >= 4) {
    const byPrefix = items.filter(
      (item) =>
        item.id.toLowerCase().startsWith(needle) ||
        item.id
          .toLowerCase()
          .replace(/^(clip_|overlay_)/, '')
          .startsWith(needle),
    )
    if (byPrefix.length === 1) return byPrefix[0]
  }

  const suffix = /(?:^|-)([a-f0-9]{8})$/i.exec(needle)
  if (suffix) {
    const id8 = suffix[1].toLowerCase()
    const byTail = items.find((item) =>
      item.id
        .toLowerCase()
        .replace(/^(clip_|overlay_)/, '')
        .startsWith(id8),
    )
    if (byTail) return byTail
  }

  return undefined
}

const collectMatches = (
  pattern: RegExp,
  text: string,
): Array<{ token: string; body: string; start: number; end: number }> => {
  const matches: Array<{ token: string; body: string; start: number; end: number }> = []
  pattern.lastIndex = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index == null) continue
    matches.push({
      token: match[0],
      body: match[1],
      start: match.index,
      end: match.index + match[0].length,
    })
  }
  return matches
}

export const listGroundingChips = (input: {
  text: string
  clips: readonly ClipRefLike[]
  overlays: readonly OverlayRefLike[]
  assets?: readonly AssetRefLike[]
}): GroundingChip[] => {
  const assets = input.assets ?? []
  const chips: GroundingChip[] = []

  for (const match of collectMatches(TIME_TOKEN, input.text)) {
    const seconds = parseTimeBody(match.body)
    chips.push({
      kind: 'time',
      token: match.token,
      label: seconds == null ? match.token : formatTimeChipLabel(seconds),
      start: match.start,
      end: match.end,
    })
  }

  for (const match of collectMatches(CLIP_TOKEN, input.text)) {
    const clip = findByTokenBody(
      match.body,
      input.clips,
      (item) => clipTokenFor(item, assets),
      '@clip:',
    )
    chips.push({
      kind: 'clip',
      token: match.token,
      label: clip ? `@ ${clipLabel(clip, assets)}` : match.token,
      start: match.start,
      end: match.end,
    })
  }

  for (const match of collectMatches(OVERLAY_TOKEN, input.text)) {
    const overlay = findByTokenBody(match.body, input.overlays, overlayTokenFor, '@overlay:')
    chips.push({
      kind: 'overlay',
      token: match.token,
      label: overlay ? `@ ${overlayLabel(overlay)}` : match.token,
      start: match.start,
      end: match.end,
    })
  }

  return chips.sort((a, b) => a.start - b.start)
}

export const stripGroundingTokens = (text: string): string =>
  text
    .replace(TIME_TOKEN, '')
    .replace(CLIP_TOKEN, '')
    .replace(OVERLAY_TOKEN, '')
    .replace(/ {2,}/g, ' ')
    .trim()

export const removeGroundingToken = (text: string, chip: GroundingChip): string => {
  const before = text.slice(0, chip.start)
  const after = text.slice(chip.end)
  return `${before}${after}`.replace(/ {2,}/g, ' ').trimStart()
}

export const implicitGroundedLabel = (input: {
  text: string
  clips: readonly ClipRefLike[]
  overlays: readonly OverlayRefLike[]
  assets?: readonly AssetRefLike[]
  implicit?: ImplicitChatGrounding
}): string | null => {
  const hasClipToken = collectMatches(CLIP_TOKEN, input.text).length > 0
  const hasOverlayToken = collectMatches(OVERLAY_TOKEN, input.text).length > 0

  if (!hasClipToken && input.implicit?.clipId) {
    const clip = input.clips.find((item) => item.id === input.implicit?.clipId)
    if (clip) return clipLabel(clip, input.assets ?? [])
  }
  if (!hasOverlayToken && input.implicit?.overlayId) {
    const overlay = input.overlays.find((item) => item.id === input.implicit?.overlayId)
    if (overlay) return overlayLabel(overlay)
  }
  return null
}

/**
 * Resolve typed tokens, then fill implicit selection for kinds that have no token.
 * Tokens win. Fail closed if a typed token does not resolve.
 */
export const resolveChatGrounding = (input: {
  text: string
  clips: readonly ClipRefLike[]
  overlays: readonly OverlayRefLike[]
  assets?: readonly AssetRefLike[]
  implicit?: ImplicitChatGrounding
  durationSeconds?: number
}): ResolvedChatGrounding => {
  const assets = input.assets ?? []
  const chips = listGroundingChips({
    text: input.text,
    clips: input.clips,
    overlays: input.overlays,
    assets,
  })
  const payload: ChatGroundingPayload = {}
  let hasClipToken = false
  let hasOverlayToken = false

  for (const match of collectMatches(TIME_TOKEN, input.text)) {
    const seconds = parseTimeBody(match.body)
    if (seconds == null) {
      return { payload: {}, chips, error: 'That time isn’t on this cut.' }
    }
    if (input.durationSeconds != null && seconds > input.durationSeconds + 0.5) {
      return { payload: {}, chips, error: 'That time isn’t on this cut.' }
    }
    payload.tSeconds = seconds
  }

  for (const match of collectMatches(CLIP_TOKEN, input.text)) {
    hasClipToken = true
    const clip = findByTokenBody(
      match.body,
      input.clips,
      (item) => clipTokenFor(item, assets),
      '@clip:',
    )
    if (!clip) {
      return { payload: {}, chips, error: 'That clip is gone — pick another.' }
    }
    payload.clipId = clip.id
  }

  for (const match of collectMatches(OVERLAY_TOKEN, input.text)) {
    hasOverlayToken = true
    const overlay = findByTokenBody(match.body, input.overlays, overlayTokenFor, '@overlay:')
    if (!overlay) {
      return { payload: {}, chips, error: 'That overlay is gone — pick another.' }
    }
    payload.overlayId = overlay.id
  }

  if (!hasClipToken && input.implicit?.clipId) {
    const clip = input.clips.find((item) => item.id === input.implicit?.clipId)
    if (clip) payload.clipId = clip.id
  }
  if (!hasOverlayToken && input.implicit?.overlayId) {
    const overlay = input.overlays.find((item) => item.id === input.implicit?.overlayId)
    if (overlay) payload.overlayId = overlay.id
  }

  return { payload, chips }
}

export const groundingReferenceBlock = (payload: ChatGroundingPayload): string => {
  const lines: string[] = []
  if (payload.tSeconds != null) {
    lines.push(`- tSeconds=${payload.tSeconds} (${formatTimeChipLabel(payload.tSeconds).slice(2)})`)
  }
  if (payload.clipId) lines.push(`- clipId=${payload.clipId}`)
  if (payload.overlayId) lines.push(`- overlayId=${payload.overlayId}`)
  if (lines.length === 0) return ''
  return [
    '## Grounding (this turn)',
    'The operator named what/when. Use these ids with existing tools (trim_clip, remove_clip, update_overlay, place_shot, …). Do not invent clip or overlay ids. Grounding is not a command — still call a tool.',
    ...lines,
  ].join('\n')
}
