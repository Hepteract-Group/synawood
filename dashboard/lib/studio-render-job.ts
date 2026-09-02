export type StudioRenderJobLite = {
  id: string
  status: string
  errorMessage?: string | null
}

export type RenderOutputLite = {
  kind: string
  signedUrl: string
}

/** Video first; otherwise any signed output (stills-only export). */
export const videoDownloadUrlFromOutputs = (
  outputs: RenderOutputLite[] | null | undefined,
): string | null => {
  if (!outputs?.length) return null
  const video = outputs.find((row) => row.kind === 'video' && row.signedUrl)
  if (video?.signedUrl) return video.signedUrl
  const any = outputs.find((row) => row.signedUrl)
  return any?.signedUrl ?? null
}

export const dismissedRenderStorageKey = (jobId: string): string =>
  `mos.studio.dismissedRender:${jobId}`

export const isCancelledRenderJob = (job: StudioRenderJobLite): boolean =>
  job.status === 'failed' && Boolean(job.errorMessage?.toLowerCase().includes('cancel'))

export const readDismissedRenderJob = (jobId: string): boolean => {
  try {
    return localStorage.getItem(dismissedRenderStorageKey(jobId)) === '1'
  } catch {
    return false
  }
}

export const markRenderJobDismissed = (jobId: string): void => {
  try {
    localStorage.setItem(dismissedRenderStorageKey(jobId), '1')
  } catch {
    // Private mode — in-memory dismiss still works for this session.
  }
}

/** Hydrate in-flight and completed jobs. Skip cancelled. Dismiss only hides failed jobs. */
export const shouldHydrateLatestRenderJob = (
  job: StudioRenderJobLite | null | undefined,
): boolean => {
  if (!job) return false
  if (isCancelledRenderJob(job)) return false
  // Completed encodes keep Download video available after Dismiss (#1271).
  if (job.status === 'completed') return true
  if (readDismissedRenderJob(job.id)) return false
  return true
}
