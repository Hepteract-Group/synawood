import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudioProject } from '../project/schema'
import type { BlobEnv } from '../persistence/blob'

export type ToolResult = {
  ok: true
  summary: string
  data?: Record<string, unknown>
}

export type ToolFailure = {
  ok: false
  error: string
  /** Optional machine code (e.g. trial_paid_video) for Studio UX. */
  code?: string
}

export type ToolOutcome = ToolResult | ToolFailure

export type ToolTraceEntry = {
  id: string
  toolName: string
  input: Record<string, unknown>
  outcome: ToolOutcome
  at: string
}

export type StudioToolContext = {
  productId: string
  projectId: string
  project: StudioProject
  expectedRevision: number
  supabase: SupabaseClient
  blobEnv: BlobEnv
  modelProfileId: string
  /** When false, tools mutate in-memory only (unit tests). */
  persist: boolean
  toolTrace: ToolTraceEntry[]
  /** Founder confirmed paid generator spend for this turn (video soft-cap gate). */
  confirmSpend?: boolean
  /** When set, overrides profile.video for generate_video_clip. */
  videoModelId?: string | null
  /** This-turn @asset ids (generate_video_clip uses mentioned stills as refs). */
  referencedAssetIds?: string[]
  /** Product-level optional generate tools turned off in Settings → Agent tools. */
  disabledOptional?: readonly string[]
  /** Operator message this turn — extract tools fall back to pasted URLs. */
  userMessage?: string
  /**
   * When true on authored projects, remove_clip may delete generator speech/music.
   * Set only for an explicit remove-audio turn job (#1329).
   */
  allowRemoveAuthoredAudio?: boolean
  /**
   * Generation plan id to snapshot into generation job records (ADR-0085/0086).
   * Set when a confirmed plan (status 'ready') triggered this generate turn.
   */
  generationPlanId?: string
  /** Live SSE: tool started (before execute). May return a Promise so the stream can flush. */
  onToolStart?: (toolName: string) => void | Promise<void>
  /** Live SSE: tool finished (after execute, including failures). */
  onTool?: (entry: ToolTraceEntry) => void
}

export const toolOk = (summary: string, data?: Record<string, unknown>): ToolResult => ({
  ok: true,
  summary,
  data,
})

export const toolFail = (error: string, code?: string): ToolFailure => ({
  ok: false,
  error,
  ...(code ? { code } : {}),
})

export const plainToolError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return 'Tool failed for an unknown reason'
}
