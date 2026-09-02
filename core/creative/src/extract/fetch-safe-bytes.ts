import { EXTRACT_URL_MAX_BYTES, EXTRACT_URL_TIMEOUT_MS } from './types'
import { assertSafeFetchUrl, type HostLookup, UnsafeUrlError } from './ssrf'
import type { FetchLike } from './url-adapter'

export const EXTRACT_IMAGE_MAX_BYTES = 2_000_000
export const EXTRACT_IMAGE_TIMEOUT_MS = 8_000

export type FetchedBytes = {
  bytes: Buffer
  contentType?: string
  finalUrl: string
}

/** SSRF-safe GET of binary content (images, CSS) with size/time caps. */
export const fetchSafeBytes = async (input: {
  url: string
  fetchImpl?: FetchLike
  lookup?: HostLookup
  maxBytes?: number
  timeoutMs?: number
  accept?: string
}): Promise<FetchedBytes> => {
  const maxBytes = input.maxBytes ?? EXTRACT_IMAGE_MAX_BYTES
  const timeoutMs = input.timeoutMs ?? EXTRACT_IMAGE_TIMEOUT_MS
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
      headers: {
        Accept: input.accept ?? 'image/*,*/*;q=0.1',
      },
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

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > maxBytes) {
    throw new UnsafeUrlError(`Response exceeded ${maxBytes} bytes`)
  }

  return {
    bytes: buffer,
    contentType,
    finalUrl: finalUrl.toString(),
  }
}

/** Re-export HTML-sized caps for callers that want the page budget. */
export { EXTRACT_URL_MAX_BYTES, EXTRACT_URL_TIMEOUT_MS }
