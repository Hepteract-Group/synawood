export const playableJobKind = (
  kind: string | null | undefined,
): kind is 'image' | 'video' | 'audio' => kind === 'image' || kind === 'video' || kind === 'audio'

export const previewUrlForJob = (job: {
  projectId: string | null
  outputAssetId: string | null
}): string | null => {
  if (!job.projectId || !job.outputAssetId) return null
  return `/api/studio/projects/${encodeURIComponent(job.projectId)}/assets/${encodeURIComponent(job.outputAssetId)}/content`
}

export const retryNeedsConfirm = (estimatedGbp: number | null): boolean => (estimatedGbp ?? 0) > 0

export const jobCanPlace = (job: { status: string; outputAssetId: string | null }): boolean =>
  job.status === 'ready' && Boolean(job.outputAssetId)

export const studioHrefForJob = (projectId: string | null): string =>
  projectId ? `/studio/${projectId}` : '/studio'
