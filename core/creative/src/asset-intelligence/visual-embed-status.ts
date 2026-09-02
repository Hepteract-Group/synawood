/** Marker on ready index rows when visual embed skipped or failed (#582). */

export const VISUAL_EMBED_FAILED_PREFIX = 'visual embed failed' as const
export const VISUAL_EMBED_SKIPPED_PREFIX = 'visual embed skipped' as const
export const VISUAL_EMBED_CAP_SKIP_MESSAGE =
  `${VISUAL_EMBED_SKIPPED_PREFIX}: near spend cap. Retry with confirm spend.` as const

export const isVisualEmbedCapSkip = (lastError: string | null | undefined): boolean =>
  Boolean(lastError?.includes(VISUAL_EMBED_CAP_SKIP_MESSAGE))

export const isVisualEmbedFailed = (lastError: string | null | undefined): boolean =>
  Boolean(
    lastError &&
    !isVisualEmbedCapSkip(lastError) &&
    !isUnrecoverableIndexError(lastError) &&
    lastError.includes(VISUAL_EMBED_FAILED_PREFIX),
  )

/** Caption/embed will never succeed — Retry on the same bytes is a no-op (#645). */
export const isUnrecoverableIndexError = (lastError: string | null | undefined): boolean => {
  if (!lastError) return false
  const lower = lastError.toLowerCase()
  return (
    lower.includes('does not represent a valid image') ||
    lower.includes('provided image is not valid') ||
    lower.includes('supported image formats')
  )
}
