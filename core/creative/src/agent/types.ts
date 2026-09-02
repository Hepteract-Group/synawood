import type { ChatGroundingPayload } from '../project/grounding-token'
import type { StudioProject } from '../project/schema'
import type { ToolTraceEntry } from '../tools/types'

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  /** Tool receipts for this assistant turn (ADR-0019 Activity). */
  activity?: ToolTraceEntry[]
}

export type RunTurnInput = {
  productId: string
  projectId: string
  /** Acting user — loads Account-scoped pack installs (ADR-0080). */
  userId?: string
  messages: ChatMessage[]
  userMessage: string
  modelProfileId?: string
  abortSignal?: AbortSignal
  maxSteps?: number
  /** Founder confirmed paid generator spend for this turn. */
  confirmSpend?: boolean
  /** Implicit timeline selection when the message has no @clip/@overlay token. */
  grounding?: ChatGroundingPayload
  /** Chat-footer mode. Detection may override for this turn (#1325). */
  turnMode?: import('./turn-mode').TurnMode
}

export type ReasonerSpend = {
  role: 'reasoner'
  modelId: string
  inputTokens: number
  outputTokens: number
  estimatedGbp: number
}

export type RunTurnResult = {
  messages: ChatMessage[]
  project: StudioProject
  toolTrace: ToolTraceEntry[]
  assistantText: string
  skillIds: string[]
  /** Token £ estimate for this turn’s reasoner (omitted for mock / zero). */
  reasonerSpend?: ReasonerSpend
}

/** Talking-head / default tool loop. */
export const DEFAULT_MAX_STEPS = 16

/** Motion first-pass: brand + kit + write + music + inspect + CountUp patches. */
export const MOTION_FIRST_PASS_MAX_STEPS = 28
