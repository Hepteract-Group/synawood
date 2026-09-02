/**
 * Pure `@slide:` token helpers — no Node or schema imports.
 * Safe for both client components and server/agent code.
 */

export type SlideRefLike = {
  id: string
  order: number
  headline: string
  layout?: string
  body?: string
}

export type ResolvedSlideReference = {
  token: string
  slideId: string
  order: number
  layout?: string
  headline: string
}

const SLIDE_TOKEN = /@slide:([a-zA-Z0-9][^\s@]*)/g

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

/** Display label for autocomplete / UI. */
export const slideLabel = (slide: SlideRefLike): string => {
  const n = slide.order + 1
  const headline = slide.headline.trim()
  return headline ? `Slide ${n}: ${headline}` : `Slide ${n}`
}

/**
 * Canonical mention token.
 * Prefer human-friendly `@slide:3-hook-line`; always resolvable via order prefix.
 */
export const slideTokenFor = (slide: SlideRefLike): string => {
  const n = slide.order + 1
  const slug = slugify(slide.headline)
  return slug ? `@slide:${n}-${slug}` : `@slide:${n}`
}

const findSlideForToken = (
  raw: string,
  slides: readonly SlideRefLike[],
): SlideRefLike | undefined => {
  const needle = raw.toLowerCase()
  const sorted = [...slides].sort((a, b) => a.order - b.order)

  // Exact canonical token body
  const exact = sorted.find(
    (slide) => slideTokenFor(slide).slice('@slide:'.length).toLowerCase() === needle,
  )
  if (exact) return exact

  // Raw slide id (slide_1)
  const byId = sorted.find((slide) => slide.id.toLowerCase() === needle)
  if (byId) return byId

  // 1-based index: "3" or "3-anything"
  const indexMatch = /^(\d+)(?:-|$)/.exec(needle)
  if (indexMatch) {
    const index = Number(indexMatch[1]) - 1
    const byOrder = sorted.find((slide) => slide.order === index)
    if (byOrder) return byOrder
  }

  // Headline slug alone (when unique)
  if (needle.length >= 3) {
    const bySlug = sorted.filter((slide) => {
      const slug = slugify(slide.headline)
      return slug === needle || slug.startsWith(needle)
    })
    if (bySlug.length === 1) return bySlug[0]
  }

  return undefined
}

/** Resolve `@slide:` tokens in a user message to concrete slideshow slides. */
export const resolveSlideReferences = (
  text: string,
  slides: readonly SlideRefLike[],
): ResolvedSlideReference[] => {
  if (!text || slides.length === 0) return []
  const seen = new Set<string>()
  const refs: ResolvedSlideReference[] = []
  for (const match of text.matchAll(SLIDE_TOKEN)) {
    const body = match[1]
    if (!body) continue
    const slide = findSlideForToken(body, slides)
    if (!slide || seen.has(slide.id)) continue
    seen.add(slide.id)
    refs.push({
      token: match[0],
      slideId: slide.id,
      order: slide.order,
      layout: slide.layout,
      headline: slide.headline,
    })
  }
  return refs
}
