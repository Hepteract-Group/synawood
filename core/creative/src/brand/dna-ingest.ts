/** URL page ingest → Brand DNA draft (ADR-0044 / #106). */

import { fetchSafeBytes } from '../extract/fetch-safe-bytes'
import { UnsafeUrlError } from '../extract/ssrf'
import type { BrandDna, DnaFieldKey } from './dna'
import { isDnaFieldKey, parseBrandDna } from './dna'

const metaContent = (html: string, names: string[]): string => {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      'i',
    )
    const match = html.match(re)
    if (match?.[1]?.trim()) return decodeHtml(match[1].trim())
    const reFlip = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
      'i',
    )
    const flip = html.match(reFlip)
    if (flip?.[1]?.trim()) return decodeHtml(flip[1].trim())
  }
  return ''
}

const decodeHtml = (value: string): string =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')

export const extractDnaDraftFromHtml = (
  html: string,
  pageUrl: string,
  productId: string,
): BrandDna => {
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ||
    decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? '')
  const description = metaContent(html, ['og:description', 'description', 'twitter:description'])
  const canonical = metaContent(html, ['og:url']) || pageUrl
  return parseBrandDna(
    {
      productId,
      tagline: title.slice(0, 200),
      offer: description.slice(0, 2000),
      business: { url: canonical.slice(0, 300), locale: 'en' },
    },
    productId,
  )
}

export const ingestDnaFromUrl = async (input: {
  productId: string
  url: string
}): Promise<{ draft: BrandDna; sourceUrl: string }> => {
  const trimmed = input.url.trim()
  if (!trimmed) throw new Error('Paste a public https URL to draft Brand DNA.')
  try {
    const fetched = await fetchSafeBytes({
      url: trimmed,
      maxBytes: 1_500_000,
      timeoutMs: 12_000,
      accept: 'text/html,application/xhtml+xml,*/*;q=0.1',
    })
    const html = fetched.bytes.toString('utf8')
    return {
      draft: extractDnaDraftFromHtml(html, fetched.finalUrl, input.productId),
      sourceUrl: fetched.finalUrl,
    }
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new Error(error.message)
    }
    throw new Error(error instanceof Error ? error.message : 'Could not fetch that page.')
  }
}

const applyOneField = (next: BrandDna, draft: BrandDna, field: DnaFieldKey): void => {
  switch (field) {
    case 'tagline':
      next.tagline = draft.tagline
      return
    case 'values':
      next.values = draft.values
      return
    case 'icp':
      next.icp = draft.icp
      return
    case 'offer':
      next.offer = draft.offer
      return
    case 'proofPoints':
      next.proofPoints = draft.proofPoints
      return
    case 'business.legalName':
      next.business.legalName = draft.business.legalName
      return
    case 'business.category':
      next.business.category = draft.business.category
      return
    case 'business.url':
      next.business.url = draft.business.url
      return
    case 'business.locale':
      next.business.locale = draft.business.locale
  }
}

export const applyDnaDraftFields = (input: {
  current: BrandDna
  draft: BrandDna
  fields: string[]
}): BrandDna => {
  const locked = new Set(input.current.lockedFields)
  const next: BrandDna = { ...input.current, business: { ...input.current.business } }
  for (const field of input.fields) {
    if (locked.has(field) || !isDnaFieldKey(field)) continue
    applyOneField(next, input.draft, field)
  }
  return parseBrandDna(next, input.current.productId)
}
