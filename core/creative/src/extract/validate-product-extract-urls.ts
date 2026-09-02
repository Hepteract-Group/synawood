import { assertSafeFetchUrl, UnsafeUrlError, type HostLookup } from './ssrf'

export type ValidatedProductExtractUrl = {
  raw: string
  normalized: URL
}

/** Fail closed before enqueue — one bad URL blocks the whole job (ADR-0089 SSRF). */
export const validateProductExtractUrls = async (
  urls: string[],
  options?: { lookup?: HostLookup },
): Promise<ValidatedProductExtractUrl[]> => {
  const trimmed = urls.map((url) => url.trim()).filter(Boolean)
  if (trimmed.length === 0) {
    throw new Error('At least one public URL is required')
  }
  const seen = new Set<string>()
  const validated: ValidatedProductExtractUrl[] = []
  for (const raw of trimmed) {
    const normalized = await assertSafeFetchUrl(raw, options)
    const key = normalized.href
    if (seen.has(key)) continue
    seen.add(key)
    validated.push({ raw, normalized })
  }
  if (validated.length === 0) {
    throw new Error('At least one public URL is required')
  }
  return validated
}

export { UnsafeUrlError }
