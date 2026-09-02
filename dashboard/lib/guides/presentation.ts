import type { GuideDefinition, GuideKind, GuideStep } from './catalogue'
import type { GuideProgressStatus } from './progress'

export type GuideProgressSnapshot = {
  guideId: string
  status: string
  stepIndex: number
}

export type SessionEligibleGuide = {
  id: string
  kind: GuideKind | string
  title: string
  summary: string
  steps: GuideStep[]
  status: string
  stepIndex: number
}

export type GuideListItem = {
  id: string
  title: string
  summary: string
  kind: GuideKind
  stepCount: number
  status: string
  stepIndex: number
}

export type GuideHostView =
  | { type: 'hidden' }
  | { type: 'error'; message: string }
  | { type: 'start'; guide: SessionEligibleGuide }
  | { type: 'step'; guide: SessionEligibleGuide; stepIndex: number; cardOpen: boolean }
  | { type: 'complete'; title: string }

export type GuideUiAction = 'start' | 'next' | 'back' | 'skip' | 'complete' | 'replay'

export type Box = { top: number; left: number; right: number; bottom: number }

export const GUIDE_RUNTIME_EVENT = 'mos-guide-runtime'
export const GUIDE_SESSION_FLAG = 'mos-guides-evaluated'
export const GUIDE_SESSION_CACHE = 'mos-guides-session-v1'
export const GUIDE_PROMPTED_KEY = 'mos-guides-prompted'

export const isGuideInProgress = (status: string | undefined): boolean => status === 'in_progress'

export const shouldShowGuideStart = (progress: GuideProgressSnapshot | undefined): boolean =>
  !progress || progress.status === 'pending' || progress.status === 'not_seen'

export const formatGuideChip = (
  stepIndex: number,
  stepCount: number,
): { label: string; fraction: string } => ({
  label: 'Guide',
  fraction: `${Math.max(1, stepIndex + 1)}/${Math.max(1, stepCount)}`,
})

export const guideStatusLabel = (status: string): string => {
  switch (status) {
    case 'in_progress':
      return 'In progress'
    case 'completed':
      return 'Done'
    case 'dismissed':
      return 'Dismissed'
    default:
      return 'Not seen'
  }
}

export const guideSettingsAction = (status: string): 'Start' | 'Resume' | 'Replay' => {
  if (status === 'in_progress') return 'Resume'
  if (status === 'completed' || status === 'dismissed') return 'Replay'
  return 'Start'
}

export const splitGuideEmphasis = (body: string): { text: string; strong: boolean }[] => {
  const parts = body.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0)
  return parts.map((part) =>
    part.startsWith('**') && part.endsWith('**')
      ? { text: part.slice(2, -2), strong: true }
      : { text: part, strong: false },
  )
}

export const listGuidesForSettings = (
  catalogue: GuideDefinition[],
  progress: GuideProgressSnapshot[],
): GuideListItem[] => {
  const progressById = new Map(progress.map((row) => [row.guideId, row]))
  return catalogue.map((guide) => {
    const row = progressById.get(guide.id)
    return {
      id: guide.id,
      title: guide.title,
      summary: guide.summary,
      kind: guide.kind,
      stepCount: guide.steps.length,
      status: row?.status ?? 'not_seen',
      stepIndex: row?.stepIndex ?? 0,
    }
  })
}

export const pickActiveGuide = (
  eligible: SessionEligibleGuide[],
  catalogue: GuideDefinition[],
): SessionEligibleGuide | null => {
  const first = eligible[0]
  if (!first) return null
  const definition = catalogue.find((guide) => guide.id === first.id)
  if (!definition) return first
  return {
    ...first,
    title: definition.title,
    summary: definition.summary,
    steps: definition.steps,
    kind: definition.kind,
  }
}

export const pickGuideHostView = (input: {
  ready: boolean
  blockedByJob: boolean
  cardOpen: boolean
  showComplete: boolean
  completeTitle: string
  guide: SessionEligibleGuide | null
  autoPromptUsed: boolean
  error?: string | null
}): GuideHostView => {
  if (input.showComplete) {
    return { type: 'complete', title: input.completeTitle }
  }
  if (input.ready && input.error && !input.guide) {
    return { type: 'error', message: input.error }
  }
  if (!input.ready || !input.guide) {
    return { type: 'hidden' }
  }
  if (isGuideInProgress(input.guide.status)) {
    const last = Math.max(0, input.guide.steps.length - 1)
    return {
      type: 'step',
      guide: input.guide,
      stepIndex: Math.min(Math.max(0, input.guide.stepIndex), last),
      cardOpen: input.cardOpen,
    }
  }
  if (shouldShowGuideStart({ guideId: input.guide.id, status: input.guide.status, stepIndex: 0 })) {
    if (input.autoPromptUsed || input.blockedByJob) return { type: 'hidden' }
    return { type: 'start', guide: input.guide }
  }
  return { type: 'hidden' }
}

export const progressAfterAction = (input: {
  action: GuideUiAction
  stepIndex: number
  stepCount: number
}): { status: GuideProgressStatus; stepIndex: number } => {
  const last = Math.max(0, input.stepCount - 1)
  const current = Math.min(Math.max(0, input.stepIndex), last)
  switch (input.action) {
    case 'start':
    case 'replay':
      return { status: 'in_progress', stepIndex: 0 }
    case 'back':
      return { status: 'in_progress', stepIndex: Math.max(0, current - 1) }
    case 'next':
      return { status: 'in_progress', stepIndex: Math.min(last, current + 1) }
    case 'complete':
      return { status: 'completed', stepIndex: last }
    case 'skip':
      return { status: 'dismissed', stepIndex: current }
  }
}

export const placeGuideCard = (input: {
  target: Box | null
  viewport: { width: number; height: number }
  card: { width: number; height: number }
  gap?: number
  inset?: number
  studioDock?: boolean
}): { top: number; left: number; width: number; centered: boolean } => {
  const gap = input.gap ?? 12
  const inset = input.inset ?? 16
  const { viewport, card } = input
  const maxWidth = Math.min(card.width, Math.max(0, viewport.width - inset * 2))
  const height = card.height

  if (viewport.width <= 640) {
    return {
      top: Math.max(inset, viewport.height - height - inset),
      left: inset,
      width: viewport.width - inset * 2,
      centered: !input.target,
    }
  }

  if (input.studioDock) {
    return {
      top: Math.max(inset, 88),
      left: inset,
      width: maxWidth,
      centered: false,
    }
  }

  if (!input.target) {
    return {
      top: Math.max(inset, (viewport.height - height) / 2),
      left: Math.max(inset, (viewport.width - maxWidth) / 2),
      width: maxWidth,
      centered: true,
    }
  }

  const fits = (top: number, left: number) =>
    top >= inset &&
    left >= inset &&
    top + height <= viewport.height - inset &&
    left + maxWidth <= viewport.width - inset

  const below = { top: input.target.bottom + gap, left: input.target.left }
  if (fits(below.top, below.left)) {
    return { ...below, width: maxWidth, centered: false }
  }
  const right = { top: input.target.top, left: input.target.right + gap }
  if (fits(right.top, right.left)) {
    return { ...right, width: maxWidth, centered: false }
  }
  const above = { top: input.target.top - gap - height, left: input.target.left }
  if (fits(above.top, above.left)) {
    return { ...above, width: maxWidth, centered: false }
  }
  const left = { top: input.target.top, left: input.target.left - gap - maxWidth }
  if (fits(left.top, left.left)) {
    return { ...left, width: maxWidth, centered: false }
  }

  return {
    top: Math.min(
      Math.max(inset, input.target.bottom + gap),
      Math.max(inset, viewport.height - height - inset),
    ),
    left: Math.min(
      Math.max(inset, input.target.left),
      Math.max(inset, viewport.width - maxWidth - inset),
    ),
    width: maxWidth,
    centered: false,
  }
}

export const nextGuideCardPos = (
  prev: { top: number; left: number; width: number; centered: boolean },
  next: { top: number; left: number; width: number; centered: boolean },
): { top: number; left: number; width: number; centered: boolean } =>
  prev.top === next.top &&
  prev.left === next.left &&
  prev.width === next.width &&
  prev.centered === next.centered
    ? prev
    : next

export const emitGuideRuntime = (): void => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(GUIDE_RUNTIME_EVENT))
}
