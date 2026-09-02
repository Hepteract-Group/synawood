const STATUSES = ['pending', 'in_progress', 'completed', 'dismissed'] as const

export type GuideProgressStatus = (typeof STATUSES)[number]

export type GuideProgressWrite = {
  status: GuideProgressStatus
  stepIndex: number
}

export const parseGuideProgressWrite = (body: unknown): GuideProgressWrite => {
  if (!body || typeof body !== 'object') {
    throw new Error('Send a JSON body.')
  }
  const record = body as Record<string, unknown>
  if (
    typeof record.status !== 'string' ||
    !(STATUSES as readonly string[]).includes(record.status)
  ) {
    throw new Error('Pick a valid guide status.')
  }
  const stepIndex =
    record.stepIndex === undefined || record.stepIndex === null ? 0 : Number(record.stepIndex)
  if (!Number.isInteger(stepIndex) || stepIndex < 0) {
    throw new Error('Step must be zero or a positive whole number.')
  }
  return { status: record.status as GuideProgressStatus, stepIndex }
}

export const canTransitionGuideStatus = (
  current: string | null | undefined,
  next: GuideProgressStatus,
): boolean => {
  if (next === 'pending') return !current || current === 'pending'
  if (current === 'completed' || current === 'dismissed') {
    return next === 'in_progress' || next === current
  }
  return true
}
