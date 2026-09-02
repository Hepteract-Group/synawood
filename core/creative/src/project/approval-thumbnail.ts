import { studioProjectSchema, type StudioProject } from './schema'

export const MAX_THUMBNAIL_CANDIDATES = 4

const isImageAsset = (project: StudioProject, assetId: string): boolean =>
  project.assets.some((asset) => asset.id === assetId && asset.kind === 'image')

export const channelNeedsThumbnail = (channel: string): boolean =>
  channel.toLowerCase().includes('youtube')

export const addThumbnailCandidate = (project: StudioProject, assetId: string): StudioProject => {
  if (!isImageAsset(project, assetId)) {
    throw new Error('Pick a still from this cut')
  }
  const current = [...(project.thumbnailCandidateIds ?? [])]
  if (current.includes(assetId)) {
    throw new Error('That still is already a thumbnail option')
  }
  const ids = [...current, assetId]
  const selected = project.thumbnailAssetId
  while (ids.length > MAX_THUMBNAIL_CANDIDATES) {
    const dropAt = ids.findIndex((id) => id !== selected && id !== assetId)
    ids.splice(dropAt === -1 ? 0 : dropAt, 1)
  }
  return studioProjectSchema.parse({
    ...project,
    thumbnailCandidateIds: ids,
    revision: project.revision + 1,
  })
}

export const pickThumbnail = (project: StudioProject, assetId: string | null): StudioProject => {
  if (assetId) {
    if (!isImageAsset(project, assetId)) {
      throw new Error('Pick a still from this cut')
    }
  }
  let candidates = [...(project.thumbnailCandidateIds ?? [])]
  if (assetId && !candidates.includes(assetId)) {
    candidates = [...candidates, assetId].slice(-MAX_THUMBNAIL_CANDIDATES)
  }
  if ((project.thumbnailAssetId ?? null) === assetId) {
    throw new Error('That still is already the thumbnail')
  }
  return studioProjectSchema.parse({
    ...project,
    thumbnailAssetId: assetId,
    thumbnailCandidateIds: candidates,
    revision: project.revision + 1,
  })
}
