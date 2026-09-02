import { extractStillAssetIds } from '../extract/prefer-extract-refs'
import type { StudioProject } from '../project/schema'

export type MotionMediaMomentHit = {
  assetId: string
  shotId?: string
}

export type BindMotionMediaInput = {
  project: StudioProject
  resolveUrl: (blobKey: string) => string
  momentHits?: readonly MotionMediaMomentHit[]
  recentHeroAssetIds?: readonly string[]
}

export type BindMotionMediaResult = {
  plates: string[]
  heroSrc?: string
  logoSrc?: string
  heroAssetId?: string
  logoAssetId?: string
  plateAssetIds: string[]
  plateShotIds: string[]
}

const MAX_PLATES = 6

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim())

/** Drop blob keys and javascript: so Chromium never sees storage keys or live-site leaks. */
export const signedMotionMediaUrl = (
  blobKey: string,
  resolveUrl: (blobKey: string) => string,
): string | undefined => {
  const key = blobKey.trim()
  if (!key || isHttpUrl(key)) return undefined
  const mapped = resolveUrl(key).trim()
  if (!mapped || mapped === key) return undefined
  if (!isHttpUrl(mapped)) return undefined
  if (/^javascript:/i.test(mapped)) return undefined
  return mapped
}

const imageAssetById = (project: StudioProject, id: string) =>
  project.assets.find((asset) => asset.id === id && asset.kind === 'image')

const pickLogoAsset = (project: StudioProject) =>
  imageAssetById(project, project.brand?.logoAssetId ?? '') ??
  project.assets.find((asset) => asset.source === 'brand_kit' && asset.kind === 'image') ??
  project.assets.find((asset) => asset.kind === 'image' && asset.blobKey.includes('/brand-kit/'))

const uniqueIds = (ids: string[]): string[] => [...new Set(ids.filter(Boolean))]

/**
 * Rank this product’s stills for authored inputProps. Moment hits and Extracts
 * beat leftover generator stock. Reuses the project library + Extracts store
 * (no second index table). Blob keys stay on the project; Chromium only gets
 * signed URLs.
 */
export const bindMotionMediaProps = (input: BindMotionMediaInput): BindMotionMediaResult => {
  const { project, resolveUrl } = input
  const recent = new Set(input.recentHeroAssetIds ?? [])
  const shotByAsset = new Map<string, string>()
  for (const hit of input.momentHits ?? []) {
    if (hit.shotId && !shotByAsset.has(hit.assetId)) {
      shotByAsset.set(hit.assetId, hit.shotId)
    }
  }

  const logoAsset = pickLogoAsset(project)
  const logoSrc = logoAsset ? signedMotionMediaUrl(logoAsset.blobKey, resolveUrl) : undefined

  const momentIds = (input.momentHits ?? [])
    .map((hit) => hit.assetId)
    .filter((id) => Boolean(imageAssetById(project, id)))
  const extractIds = extractStillAssetIds(project)
  const brandStillId = project.brand?.stillAssetId
  const brandStill = brandStillId && imageAssetById(project, brandStillId) ? [brandStillId] : []
  const generatorIds = project.assets
    .filter((asset) => asset.kind === 'image' && asset.source === 'generator')
    .map((asset) => asset.id)
  // Generator stills first only when the library has no Moments/Extracts.
  const otherImageIds = project.assets
    .filter((asset) => asset.kind === 'image' && asset.source !== 'generator')
    .map((asset) => asset.id)

  const libraryFirst = momentIds.length > 0 || extractIds.length > 0
  const ranked = uniqueIds(
    libraryFirst
      ? [...momentIds, ...extractIds, ...brandStill, ...generatorIds, ...otherImageIds]
      : [...generatorIds, ...brandStill, ...otherImageIds],
  )
  const unused = ranked.filter((id) => !recent.has(id))
  const reused = ranked.filter((id) => recent.has(id))
  const ordered = [...unused, ...reused].filter((id) => id !== logoAsset?.id)

  const boundPlates: Array<{ src: string; assetId: string; shotId?: string }> = []
  for (const id of ordered) {
    if (boundPlates.length >= MAX_PLATES) break
    const asset = imageAssetById(project, id)
    if (!asset) continue
    const src = signedMotionMediaUrl(asset.blobKey, resolveUrl)
    if (!src) continue
    boundPlates.push({
      src,
      assetId: id,
      ...(shotByAsset.get(id) ? { shotId: shotByAsset.get(id) } : {}),
    })
  }

  const plates = boundPlates.map((row) => row.src)
  const plateAssetIds = boundPlates.map((row) => row.assetId)
  const plateShotIds = boundPlates.flatMap((row) => (row.shotId ? [row.shotId] : []))

  const heroAssetId = plateAssetIds[0]
  const heroSrc = plates[0]

  return {
    plates,
    ...(heroSrc ? { heroSrc } : {}),
    ...(logoSrc ? { logoSrc } : {}),
    ...(heroAssetId ? { heroAssetId } : {}),
    ...(logoAsset ? { logoAssetId: logoAsset.id } : {}),
    plateAssetIds,
    plateShotIds,
  }
}
