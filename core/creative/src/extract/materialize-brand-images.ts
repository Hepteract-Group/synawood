import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteBlob, putBlob, type BlobEnv } from '../persistence/blob'
import type { ProjectAsset } from '../project/schema'
import type { UrlImageCandidate } from './types'
import { fetchSafeBytes, EXTRACT_IMAGE_MAX_BYTES } from './fetch-safe-bytes'
import { sampleDominantColor } from './sample-dominant-color'
import type { FetchLike } from './url-adapter'
import type { HostLookup } from './ssrf'

export type MaterializedBrandImages = {
  logoAsset?: ProjectAsset
  stillAsset?: ProjectAsset
  sampledPrimaryColor?: string
  sampledAccentColor?: string
}

/** Skip tiny favicons as Path C logos — prefer og:image when the icon is this small. */
export const MIN_RASTER_LOGO_BYTES = 8_000

const pickCandidate = (
  candidates: UrlImageCandidate[],
  role: UrlImageCandidate['role'],
): UrlImageCandidate | undefined => candidates.find((item) => item.role === role)

const extensionFor = (contentType: string | undefined, url: string): string => {
  const type = (contentType ?? '').toLowerCase()
  if (type.includes('svg')) return 'svg'
  if (type.includes('png')) return 'png'
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  const path = url.split('?')[0] ?? url
  const match = path.match(/\.([a-zA-Z0-9]{2,5})$/)
  return match?.[1]?.toLowerCase() ?? 'bin'
}

const contentTypeFor = (contentType: string | undefined, ext: string): string => {
  if (contentType?.startsWith('image/')) return contentType.split(';')[0]!.trim()
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'application/octet-stream'
}

const isSvg = (contentType: string | undefined, url: string): boolean => {
  const type = (contentType ?? '').toLowerCase()
  const name = url.toLowerCase()
  return type.includes('svg') || name.includes('.svg')
}

/** SVG is always usable; rasters need enough bytes to avoid blurry favicons. */
export const isSubstantialLogoBytes = (input: {
  bytes: Buffer
  contentType?: string
  url: string
}): boolean => {
  if (isSvg(input.contentType, input.url)) return true
  return input.bytes.byteLength >= MIN_RASTER_LOGO_BYTES
}

type DownloadedImage = {
  candidate: UrlImageCandidate
  bytes: Buffer
  contentType?: string
  finalUrl: string
}

const persistImageAsset = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
  bytes: Buffer
  contentType: string
  fileName: string
  probe: Record<string, unknown>
}): Promise<ProjectAsset> => {
  const assetId = randomUUID()
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  const { blobKey } = await putBlob({
    blobEnv: input.blobEnv,
    productId: input.productId,
    kind: 'brand-kit',
    parts: [input.projectId, 'extract', `${assetId}-${safeName}`],
    data: input.bytes,
    contentType: input.contentType,
  })

  const { error } = await input.supabase.from('assets').insert({
    id: assetId,
    product_id: input.productId,
    project_id: input.projectId,
    kind: 'image',
    source: 'upload',
    blob_key: blobKey,
    content_type: input.contentType,
    probe: { extract: true, ...input.probe },
  })
  if (error) {
    try {
      await deleteBlob({ blobEnv: input.blobEnv, blobKey })
    } catch {
      /* best effort */
    }
    throw new Error(`Failed to register extract image asset: ${error.message}`)
  }

  return {
    id: assetId,
    kind: 'image',
    blobKey,
    contentType: input.contentType,
    source: 'upload',
    probe: { extract: true, ...input.probe },
  }
}

const tryDownload = async (input: {
  candidate: UrlImageCandidate
  fetchImpl?: FetchLike
  lookup?: HostLookup
}): Promise<DownloadedImage | null> => {
  try {
    const fetched = await fetchSafeBytes({
      url: input.candidate.url,
      fetchImpl: input.fetchImpl,
      lookup: input.lookup,
      maxBytes: EXTRACT_IMAGE_MAX_BYTES,
      accept: 'image/*,image/svg+xml,*/*;q=0.1',
    })
    return {
      candidate: input.candidate,
      bytes: fetched.bytes,
      contentType: fetched.contentType,
      finalUrl: fetched.finalUrl,
    }
  } catch {
    return null
  }
}

const pickLogoDownload = (
  icon: DownloadedImage | null,
  og: DownloadedImage | null,
): DownloadedImage | null => {
  if (
    icon &&
    isSubstantialLogoBytes({
      bytes: icon.bytes,
      contentType: icon.contentType,
      url: icon.finalUrl,
    })
  ) {
    return icon
  }
  if (og) return og
  return icon
}

const persistAs = async (input: {
  downloaded: DownloadedImage
  role: 'logo' | 'still'
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
}): Promise<{ asset: ProjectAsset; sampled?: string }> => {
  const ext = extensionFor(input.downloaded.contentType, input.downloaded.finalUrl)
  const contentType = contentTypeFor(input.downloaded.contentType, ext)
  const asset = await persistImageAsset({
    supabase: input.supabase,
    blobEnv: input.blobEnv,
    productId: input.productId,
    projectId: input.projectId,
    bytes: input.downloaded.bytes,
    contentType,
    fileName: `${input.role}.${ext}`,
    probe: {
      role: input.role,
      sourceUrl: input.downloaded.finalUrl,
      candidateRole: input.downloaded.candidate.role,
    },
  })
  const sampled = sampleDominantColor({
    bytes: input.downloaded.bytes,
    contentType,
    fileName: `${input.role}.${ext}`,
  })
  return { asset, sampled: sampled ?? undefined }
}

/**
 * Download logo + still candidates. Prefer a substantial icon for logo; fall back to
 * og:image when the favicon is tiny so Path C doesn't ship a blurry mark.
 */
export const materializeExtractBrandImages = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
  imageCandidates: UrlImageCandidate[]
  fetchImpl?: FetchLike
  lookup?: HostLookup
}): Promise<MaterializedBrandImages> => {
  const iconCandidate = pickCandidate(input.imageCandidates, 'icon')
  const ogCandidate =
    pickCandidate(input.imageCandidates, 'og') ??
    (!iconCandidate ? input.imageCandidates[0] : undefined)

  const [iconDownload, ogDownload] = await Promise.all([
    iconCandidate
      ? tryDownload({
          candidate: iconCandidate,
          fetchImpl: input.fetchImpl,
          lookup: input.lookup,
        })
      : Promise.resolve(null),
    ogCandidate && (!iconCandidate || ogCandidate.url !== iconCandidate.url)
      ? tryDownload({
          candidate: ogCandidate,
          fetchImpl: input.fetchImpl,
          lookup: input.lookup,
        })
      : Promise.resolve(null),
  ])

  // Same URL listed as both icon + og — reuse the icon download.
  const icon = iconDownload
  const og =
    ogDownload ??
    (iconCandidate && ogCandidate && iconCandidate.url === ogCandidate.url ? iconDownload : null)

  const logoDownload = pickLogoDownload(icon, og)
  const result: MaterializedBrandImages = {}
  const colors: string[] = []

  if (logoDownload) {
    const persisted = await persistAs({
      downloaded: logoDownload,
      role: 'logo',
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      productId: input.productId,
      projectId: input.projectId,
    })
    result.logoAsset = persisted.asset
    if (persisted.sampled) colors.push(persisted.sampled)
  }

  const stillDownload =
    og && logoDownload && og.finalUrl !== logoDownload.finalUrl
      ? og
      : og && !logoDownload
        ? og
        : null

  if (stillDownload) {
    const persisted = await persistAs({
      downloaded: stillDownload,
      role: 'still',
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      productId: input.productId,
      projectId: input.projectId,
    })
    result.stillAsset = persisted.asset
    if (persisted.sampled) colors.push(persisted.sampled)
  } else if (result.logoAsset) {
    result.stillAsset = result.logoAsset
  }

  if (colors[0]) result.sampledPrimaryColor = colors[0]
  if (colors[1] && colors[1] !== colors[0]) result.sampledAccentColor = colors[1]

  return result
}
