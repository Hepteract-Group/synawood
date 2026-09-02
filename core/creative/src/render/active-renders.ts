/** In-process cancel handles for inline local Remotion encodes (Next.js API route). */
const cancelByJobId = new Map<string, () => void>()

export const registerRenderCancel = (jobId: string, cancel: () => void): void => {
  cancelByJobId.set(jobId, cancel)
}

export const clearRenderCancel = (jobId: string): void => {
  cancelByJobId.delete(jobId)
}

export const abortRegisteredRender = (jobId: string): boolean => {
  const cancel = cancelByJobId.get(jobId)
  if (!cancel) return false
  cancel()
  cancelByJobId.delete(jobId)
  return true
}

export const CANCELLED_RENDER_MESSAGE = 'Cancelled by founder'
