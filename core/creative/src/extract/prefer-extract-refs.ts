import type { StudioProject } from '../project/schema'

const INJECTABLE = new Set(['usable', 'weak'])

const isExtractStillAsset = (asset: StudioProject['assets'][number]): boolean => {
  if (asset.kind !== 'image') return false
  if (typeof asset.probe?.productExtractId !== 'string') return false
  const quality = asset.probe.quality
  return typeof quality !== 'string' || INJECTABLE.has(quality)
}

/** Project assets that came from usable/weak Product Extracts (#1098). */
export const extractStillAssetIds = (project: StudioProject): string[] =>
  project.assets.filter(isExtractStillAsset).map((asset) => asset.id)

export const nextUnusedExtractSlideBackground = (
  project: StudioProject,
  usedBackgroundIds: readonly string[],
): string | undefined => {
  const used = new Set(usedBackgroundIds.filter(Boolean))
  return extractStillAssetIds(project).find((id) => !used.has(id))
}
