/** Nested shape from GET /api/studio/generation/[jobId]. */
export const generationJobStatus = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as { job?: { status?: unknown }; status?: unknown }
  if (typeof record.job?.status === 'string' && record.job.status.trim()) {
    return record.job.status
  }
  if (typeof record.status === 'string' && record.status.trim()) {
    return record.status
  }
  return undefined
}
