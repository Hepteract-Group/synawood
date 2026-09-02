import { appendToolTraceEntries } from '@synawood/creative/agent'
import { loadProject, RevisionConflictError, type StudioProject } from '@synawood/creative/project'
import {
  createStudioTools,
  type StudioToolContext,
  type StudioToolName,
  type ToolOutcome,
} from '@synawood/creative/tools'
import type { StudioAccess } from '@/lib/studio-server'
import { jsonError } from '@/lib/studio-server'

const emptyToolCallOptions = () => ({ toolCallId: crypto.randomUUID(), messages: [] }) as never

export const createProjectToolContext = async (
  access: StudioAccess,
  projectId: string,
  expectedRevision: number,
): Promise<{ ctx: StudioToolContext; row: Awaited<ReturnType<typeof loadProject>>['row'] }> => {
  const { project, row } = await loadProject(access.supabase, projectId)
  const ctx: StudioToolContext = {
    productId: project.productId,
    projectId,
    project,
    expectedRevision,
    supabase: access.supabase,
    blobEnv: access.blobEnv,
    modelProfileId: row.model_profile_id,
    persist: true,
    toolTrace: [],
  }
  return { ctx, row }
}

export const runStudioProjectTool = async (
  access: StudioAccess,
  projectId: string,
  expectedRevision: number,
  toolName: StudioToolName,
  input: Record<string, unknown>,
): Promise<{ outcome: ToolOutcome; project: StudioProject; traceWarning?: string }> => {
  const { ctx } = await createProjectToolContext(access, projectId, expectedRevision)
  const tools = createStudioTools(ctx)
  const tool = tools[toolName]
  if (!tool?.execute) {
    throw new Error(`Studio tool unavailable: ${toolName}`)
  }
  const outcome = (await tool.execute(input as never, emptyToolCallOptions())) as ToolOutcome
  let traceWarning: string | undefined
  if (ctx.toolTrace.length > 0) {
    try {
      await appendToolTraceEntries(access.supabase, projectId, ctx.toolTrace)
    } catch (error) {
      traceWarning = error instanceof Error ? error.message : 'Failed to persist tool trace'
    }
  }
  return { outcome, project: ctx.project, traceWarning }
}

export const jsonFromToolOutcome = (
  outcome: ToolOutcome,
  extras: Record<string, unknown> = {},
): Response => {
  if (!outcome.ok) {
    const stale = /stale|revision conflict/i.test(outcome.error)
    return jsonError(outcome.error, stale ? 409 : 400)
  }
  return Response.json({
    summary: outcome.summary,
    ...(outcome.data ?? {}),
    ...extras,
  })
}

export const mapStudioRouteError = (error: unknown): Response | null => {
  if (error instanceof RevisionConflictError) {
    return jsonError(error.message, 409)
  }
  return null
}
