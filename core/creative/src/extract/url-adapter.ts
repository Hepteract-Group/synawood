import {
  EXTRACT_URL_DIGEST_MAX_CHARS,
  EXTRACT_URL_MAX_BYTES,
  EXTRACT_URL_TIMEOUT_MS,
  type UrlImageCandidate,
  type UrlSourceDigest,
} from './types'
import { assertSafeFetchUrl, type HostLookup, UnsafeUrlError } from './ssrf'
import {
  EXTRACT_CSS_MAX_BYTES_EACH,
  EXTRACT_CSS_MAX_BYTES_TOTAL,
  EXTRACT_CSS_MAX_STYLESHEETS,
  listStylesheetHrefs,
  normalizeCssHex,
  parseCssColorHits,
  rankCssColors,
  type CssColorHit,
} from './css-colors'
import { fetchSafeBytes } from './fetch-safe-bytes'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const metaContent = (html: string, names: string[]): string | undefined => {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      'i',
    )
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
      'i',
    )
    const match = html.match(re) ?? html.match(alt)
    if (match?.[1]?.trim()) return decodeHtml(match[1].trim())
  }
  return undefined
}

const decodeHtml = (value: string): string =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")

const stripTags = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const absolutize = (base: URL, href: string): string | null => {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

const collectInlineCss = (html: string): string => {
  const parts: string[] = []
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (match[1]) parts.push(match[1])
  }
  return parts.join('\n')
}

const buildColorGuesses = (themeColor: string | undefined, hits: CssColorHit[]): string[] => {
  const ranked = rankCssColors(hits, 8)
  const guesses: string[] = []
  if (themeColor) {
    const normalized = normalizeCssHex(themeColor) ?? themeColor.toLowerCase()
    guesses.push(normalized)
  }
  for (const hex of ranked) {
    if (!guesses.includes(hex) && guesses.length < 8) guesses.push(hex)
  }
  return guesses
}

export const parseHtmlDigest = (
  html: string,
  baseUrl: URL,
  maxDigestChars = EXTRACT_URL_DIGEST_MAX_CHARS,
): Omit<UrlSourceDigest, 'kind' | 'finalUrl' | 'fetchedAt' | 'contentType' | 'bytesRead'> => {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch?.[1] ? decodeHtml(stripTags(titleMatch[1])) : undefined
  const description =
    metaContent(html, ['description', 'og:description', 'twitter:description']) ?? undefined

  const imageCandidates: UrlImageCandidate[] = []
  const pushImage = (href: string | undefined, role: UrlImageCandidate['role']) => {
    if (!href) return
    const abs = absolutize(baseUrl, href)
    if (!abs) return
    if (imageCandidates.some((item) => item.url === abs)) return
    imageCandidates.push({ url: abs, role })
  }

  pushImage(metaContent(html, ['og:image', 'twitter:image']), 'og')

  for (const match of html.matchAll(
    /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/gi,
  )) {
    const tag = match[0] ?? ''
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
    pushImage(href, 'icon')
  }

  const themeRaw = metaContent(html, ['theme-color', 'msapplication-TileColor'])
  const themeColor = themeRaw?.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/)?.[0]
  const inlineHits = parseCssColorHits(collectInlineCss(html))
  const colorGuesses = buildColorGuesses(themeColor, inlineHits)

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const textDigest = stripTags(bodyMatch?.[1] ?? html).slice(0, maxDigestChars)

  return {
    title: title || undefined,
    description,
    textDigest,
    imageCandidates,
    themeColor: themeColor ? (normalizeCssHex(themeColor) ?? themeColor) : undefined,
    colorGuesses,
  }
}

/** Fetch linked stylesheets and merge ranked CSS colors into the digest. */
export const enrichDigestWithStylesheets = async (input: {
  html: string
  digest: Omit<UrlSourceDigest, 'kind' | 'finalUrl' | 'fetchedAt' | 'contentType' | 'bytesRead'>
  baseUrl: URL
  fetchImpl?: FetchLike
  lookup?: HostLookup
}): Promise<
  Omit<UrlSourceDigest, 'kind' | 'finalUrl' | 'fetchedAt' | 'contentType' | 'bytesRead'>
> => {
  const hrefs = listStylesheetHrefs(input.html, input.baseUrl, EXTRACT_CSS_MAX_STYLESHEETS)
  if (hrefs.length === 0) return input.digest

  const hits = parseCssColorHits(collectInlineCss(input.html))
  let totalBytes = 0

  for (const href of hrefs) {
    if (totalBytes >= EXTRACT_CSS_MAX_BYTES_TOTAL) break
    try {
      const fetched = await fetchSafeBytes({
        url: href,
        fetchImpl: input.fetchImpl,
        lookup: input.lookup,
        maxBytes: Math.min(EXTRACT_CSS_MAX_BYTES_EACH, EXTRACT_CSS_MAX_BYTES_TOTAL - totalBytes),
        accept: 'text/css,*/*;q=0.1',
      })
      totalBytes += fetched.bytes.byteLength
      hits.push(...parseCssColorHits(fetched.bytes.toString('utf8')))
    } catch {
      /* skip failed stylesheet — digest still useful */
    }
  }

  return {
    ...input.digest,
    colorGuesses: buildColorGuesses(input.digest.themeColor, hits),
  }
}

export const adaptUrlSource = async (input: {
  url: string
  fetchImpl?: FetchLike
  lookup?: HostLookup
  maxBytes?: number
  timeoutMs?: number
  now?: () => Date
}): Promise<UrlSourceDigest> => {
  const maxBytes = input.maxBytes ?? EXTRACT_URL_MAX_BYTES
  const timeoutMs = input.timeoutMs ?? EXTRACT_URL_TIMEOUT_MS
  const fetchImpl = input.fetchImpl ?? fetch
  const safeUrl = await assertSafeFetchUrl(input.url, { lookup: input.lookup })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetchImpl(safeUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1' },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UnsafeUrlError(`Fetch timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }

  const finalUrl = await assertSafeFetchUrl(response.url || safeUrl.toString(), {
    lookup: input.lookup,
  })

  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? undefined
  const declaredLength = Number(response.headers.get('content-length') ?? NaN)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new UnsafeUrlError(`Response too large (${declaredLength} bytes)`)
  }

  const buffer = new Uint8Array(await response.arrayBuffer())
  if (buffer.byteLength > maxBytes) {
    throw new UnsafeUrlError(`Response exceeded ${maxBytes} bytes`)
  }

  const html = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  const parsed = parseHtmlDigest(html, finalUrl)
  const enriched = await enrichDigestWithStylesheets({
    html,
    digest: parsed,
    baseUrl: finalUrl,
    fetchImpl,
    lookup: input.lookup,
  })
  const fetchedAt = (input.now ?? (() => new Date()))().toISOString()

  return {
    kind: 'url',
    finalUrl: finalUrl.toString(),
    ...enriched,
    fetchedAt,
    contentType,
    bytesRead: buffer.byteLength,
  }
}
