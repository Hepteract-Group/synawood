/** Wave / #108 — Add from URL: SSRF-safe image fetch → Blob + assets.source=url. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchSafeBytes, type FetchedBytes } from '../extract/fetch-safe-bytes'
import { UnsafeUrlError, type HostLookup } from '../extract/ssrf'
import type { FetchLike } from '../extract/url-adapter'
import type { BlobEnv } from '../persistence/blob'
import { uploadProjectAsset, type UploadedAssetResult } from './upload-asset'

export const URL_ASSET_MAX_BYTES = 8_000_000
export const URL_ASSET_TIMEOUT_MS = 15_000

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'])

export class UrlAssetIngestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlAssetIngestError'
  }
}

const fileNameFromUrl = (finalUrl: string): string => {
  try {
    const path = new URL(finalUrl).pathname
    const base = path.split('/').filter(Boolean).pop() ?? 'image'
    const decoded = decodeURIComponent(base)
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 120)
    return decoded.includes('.') ? decoded : `${decoded}.jpg`
  } catch {
    return 'image.jpg'
  }
}

const normalizeImageContentType = (contentType: string | undefined, fileName: string): string => {
  const raw = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (raw === 'image/jpg') return 'image/jpeg'
  if (IMAGE_TYPES.has(raw)) return raw
  if (raw && !raw.startsWith('image/')) {
    throw new UrlAssetIngestError('URL must point to an image (JPEG, PNG, WebP, or GIF).')
  }
  if (/\.png$/i.test(fileName)) return 'image/png'
  if (/\.webp$/i.test(fileName)) return 'image/webp'
  if (/\.gif$/i.test(fileName)) return 'image/gif'
  if (/\.jpe?g$/i.test(fileName)) return 'image/jpeg'
  throw new UrlAssetIngestError('URL must point to an image (JPEG, PNG, WebP, or GIF).')
}

export const ingestProjectAssetFromUrl = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  projectId: string
  expectedRevision: number
  url: string
  addAsClip?: boolean
  fetchImpl?: FetchLike
  lookup?: HostLookup
}): Promise<UploadedAssetResult & { finalUrl: string }> => {
  const trimmed = input.url.trim()
  if (!trimmed) {
    throw new UrlAssetIngestError('Paste an image URL to add it to the library.')
  }

  let fetched: FetchedBytes
  try {
    fetched = await fetchSafeBytes({
      url: trimmed,
      fetchImpl: input.fetchImpl,
      lookup: input.lookup,
      maxBytes: URL_ASSET_MAX_BYTES,
      timeoutMs: URL_ASSET_TIMEOUT_MS,
      accept: 'image/*,*/*;q=0.1',
    })
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new UrlAssetIngestError(
        error.message.startsWith('Blocked') || error.message.startsWith('Invalid')
          ? error.message
          : `Could not fetch that URL safely (${error.message}).`,
      )
    }
    throw new UrlAssetIngestError(
      error instanceof Error ? error.message : 'Could not fetch that URL.',
    )
  }

  const fileName = fileNameFromUrl(fetched.finalUrl)
  const contentType = normalizeImageContentType(fetched.contentType, fileName)

  const result = await uploadProjectAsset({
    supabase: input.supabase,
    blobEnv: input.blobEnv,
    projectId: input.projectId,
    expectedRevision: input.expectedRevision,
    fileName,
    contentType,
    data: fetched.bytes,
    kind: 'image',
    addAsClip: input.addAsClip ?? false,
    source: 'url',
    probeExtras: {
      sourceUrl: fetched.finalUrl.slice(0, 500),
      ingestedFromUrl: true,
    },
  })

  return { ...result, finalUrl: fetched.finalUrl }
}
