/** Caps for linked stylesheet fetches during URL extract (#369). */
export const EXTRACT_CSS_MAX_STYLESHEETS = 4
export const EXTRACT_CSS_MAX_BYTES_EACH = 400_000
export const EXTRACT_CSS_MAX_BYTES_TOTAL = 800_000

export type CssColorHit = {
  hex: string
  score: number
  source: 'token' | 'selector' | 'root' | 'other'
}

const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)/gi

const expandShortHex = (hex: string): string | null => {
  const m = /^#([0-9a-fA-F]{3})$/.exec(hex.trim())
  if (!m) return null
  const [r, g, b] = m[1]!.split('')
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
}

export const normalizeCssHex = (value: string): string | null => {
  const trimmed = value.trim()
  const short = expandShortHex(trimmed)
  if (short) return short
  const full = /^#([0-9a-fA-F]{6})$/.exec(trimmed)
  return full ? `#${full[1]!.toLowerCase()}` : null
}

const rgbToHex = (r: number, g: number, b: number): string | null => {
  if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) return null
  const to = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

const isNearNeutral = (hex: string): boolean => {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  // Near black / white
  if (max < 28 || min > 232) return true
  // Dark slate UI chrome (#101828, #364153) — low chroma, not a brand hue
  if (max < 90 && chroma < 48) return true
  // Mid greys
  if (chroma < 36) return true
  return false
}

/** True when a hex is vivid enough to use as brand primary/accent. */
export const isBrandWorthyColor = (hex: string): boolean => {
  const normalized =
    normalizeCssHex(hex) ?? (/^#[0-9a-fA-F]{6}$/i.test(hex) ? hex.toLowerCase() : null)
  if (!normalized) return false
  return !isNearNeutral(normalized)
}

const extractColorsFromValue = (value: string): string[] => {
  const out: string[] = []
  for (const match of value.matchAll(HEX_RE)) {
    const hex = normalizeCssHex(match[0] ?? '')
    if (hex) out.push(hex)
  }
  for (const match of value.matchAll(RGB_RE)) {
    const hex = rgbToHex(Number(match[1]), Number(match[2]), Number(match[3]))
    if (hex) out.push(hex)
  }
  return out
}

const scoreSelector = (selector: string): { score: number; source: CssColorHit['source'] } => {
  const s = selector.toLowerCase()
  if (
    /--(?:brand|primary|accent|secondary|cta|button|link|theme|color-primary|color-accent)/.test(s)
  ) {
    return { score: 40, source: 'token' }
  }
  if (s.includes(':root') || s === 'html' || s === 'body') {
    return { score: 18, source: 'root' }
  }
  if (
    /\b(header|nav|navbar|hero|btn|button|\.cta|\[role=["']?button)\b/.test(s) ||
    /\.(primary|brand|accent)\b/.test(s)
  ) {
    return { score: 28, source: 'selector' }
  }
  if (/\b(a|footer|main)\b/.test(s)) {
    return { score: 10, source: 'other' }
  }
  return { score: 4, source: 'other' }
}

const scoreProperty = (prop: string): number => {
  const p = prop.toLowerCase()
  if (p.startsWith('--') && /brand|primary|accent|secondary|cta|theme/.test(p)) return 20
  if (p.startsWith('--')) return 8
  if (p === 'background-color' || p === 'background') return 12
  if (p === 'color') return 8
  if (p === 'border-color' || p.startsWith('border-') || p === 'outline-color') return 5
  if (p === 'fill' || p === 'stroke') return 6
  return 2
}

/**
 * Strip comments and split roughly into rule blocks: selector { decls }.
 * Not a full CSS parser — good enough for palette ranking.
 */
export const parseCssColorHits = (css: string): CssColorHit[] => {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const hits: CssColorHit[] = []
  const ruleRe = /([^{}@][^{]*)\{([^{}]*)\}/g

  for (const match of cleaned.matchAll(ruleRe)) {
    const selector = (match[1] ?? '').trim()
    const body = match[2] ?? ''
    if (!selector || selector.startsWith('@')) continue
    const { score: selectorScore, source } = scoreSelector(selector)

    for (const decl of body.split(';')) {
      const colon = decl.indexOf(':')
      if (colon < 0) continue
      const prop = decl.slice(0, colon).trim()
      const value = decl.slice(colon + 1).trim()
      if (!prop || !value) continue
      const propScore = scoreProperty(prop)
      for (const hex of extractColorsFromValue(value)) {
        if (isNearNeutral(hex)) continue
        hits.push({
          hex,
          score: selectorScore + propScore,
          source: prop.startsWith('--') && source !== 'token' ? 'token' : source,
        })
      }
    }
  }

  // Also catch :root custom props that might sit in @media — scan loose --prop: #hex
  for (const match of cleaned.matchAll(
    /(--[a-zA-Z0-9-_]*(?:brand|primary|accent|secondary|cta|theme)[a-zA-Z0-9-_]*)\s*:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/gi,
  )) {
    for (const hex of extractColorsFromValue(match[2] ?? '')) {
      if (isNearNeutral(hex)) continue
      hits.push({ hex, score: 50, source: 'token' })
    }
  }

  return hits
}

export const rankCssColors = (hits: CssColorHit[], limit = 8): string[] => {
  const totals = new Map<string, number>()
  for (const hit of hits) {
    totals.set(hit.hex, (totals.get(hit.hex) ?? 0) + hit.score)
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .slice(0, limit)
}

export const listStylesheetHrefs = (
  html: string,
  baseUrl: URL,
  limit = EXTRACT_CSS_MAX_STYLESHEETS,
): string[] => {
  const hrefs: string[] = []
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0] ?? ''
    if (!/rel=["'][^"']*stylesheet[^"']*["']/i.test(tag)) continue
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
    if (!href) continue
    try {
      const abs = new URL(href, baseUrl).toString()
      if (!hrefs.includes(abs)) hrefs.push(abs)
    } catch {
      /* ignore bad href */
    }
    if (hrefs.length >= limit) break
  }
  return hrefs
}
