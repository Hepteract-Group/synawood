/** Marker stored on ready rows when soft caps skip caption/embed (#175 / #458). */

export const PAID_INDEX_SOFT_SKIP_PREFIX = 'Paid index stages skipped' as const

export const isPaidIndexSoftSkip = (lastError: string | null | undefined): boolean =>
  Boolean(lastError?.startsWith(PAID_INDEX_SOFT_SKIP_PREFIX))

export const PAID_INDEX_SOFT_SKIP_MESSAGE =
  `${PAID_INDEX_SOFT_SKIP_PREFIX} — confirm spend to run caption and visual embed.` as const
