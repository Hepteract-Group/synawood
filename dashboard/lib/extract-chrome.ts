/** Applied ExtractedBrief id mirrored on the Studio Project after Apply. */
export const appliedBriefIdFromProjectJson = (projectJson: unknown): string | null => {
  if (!projectJson || typeof projectJson !== 'object') return null
  const brief = (projectJson as { brief?: unknown }).brief
  if (!brief || typeof brief !== 'object') return null
  const id = (brief as { id?: unknown }).id
  return typeof id === 'string' && id.length > 0 ? id : null
}

/**
 * Chrome banner after reload: in-progress always.
 * Ready/failed only until applied or the founder dismisses that job.
 */
export const shouldRestoreExtractChrome = (input: {
  status: string
  applied: boolean
  dismissed?: boolean
}): boolean => {
  if (input.status === 'queued' || input.status === 'generating') {
    return true
  }
  if (input.status === 'failed') {
    return !input.dismissed
  }
  if (input.status === 'ready') {
    return !input.applied && !input.dismissed
  }
  return false
}

/** First-setup query only. Later edits use the Ad Generator header control. */
export const shouldOpenAdGeneratorWizard = (input: {
  wizardQuery: string | null
  briefApplied: boolean
}): boolean => input.wizardQuery === 'ad-generator' && !input.briefApplied

/** Switch Media → Extracts while a product-page extract is queued or running. */
export const shouldFocusExtractsBin = (
  jobs: readonly { role: string; status: string; extractKind?: string | null }[],
): boolean =>
  jobs.some(
    (job) =>
      job.role === 'extract' &&
      job.extractKind === 'product_pages' &&
      (job.status === 'queued' || job.status === 'generating' || job.status === 'failed'),
  )

export const searchWithoutWizard = (search: string): string => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.delete('wizard')
  params.delete('extractUrl')
  params.delete('extractSource')
  const next = params.toString()
  return next ? `?${next}` : ''
}
