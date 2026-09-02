import { appendToolTraceEntries } from '@synawood/creative/agent'
import { RevisionConflictError, type StudioProject } from '@synawood/creative/project'
import {
  createStudioTools,
  type StudioToolContext,
  type ToolOutcome,
} from '@synawood/creative/tools'
import { z } from 'zod'
import { getStudioClients, handleRouteError, jsonError } from './studio-server'
import {
  recordV1MutationIdempotency,
  replayIfStored,
  requireIdempotencyKey,
} from './v1-idempotency'
import { loadV1ProjectForKey } from './v1-project'
import { withApiKey, type ApiKeyAccess } from './with-api-key'

export { requireIdempotencyKey } from './v1-idempotency'

export const V1_CLIP_TOOL_NAMES = ['add_clip', 'trim_clip', 'remove_clip'] as const
export type V1ClipToolName = (typeof V1_CLIP_TOOL_NAMES)[number]

export const addClipBodySchema = z.object({
  projectId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  assetId: z.string().uuid(),
  from: z.number().int().nonnegative().optional(),
  durationInFrames: z.number().int().positive().optional(),
  trimStartFrames: z.number().int().nonnegative().optional(),
  trackId: z.string().min(1).optional(),
})

export const trimClipBodySchema = z.object({
  projectId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  clipId: z.string().min(1),
  from: z.number().int().nonnegative().optional(),
  durationInFrames: z.number().int().positive(),
  trimStartFrames: z.number().int().nonnegative().optional(),
})

export const removeClipBodySchema = z.object({
  projectId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  clipId: z.string().min(1),
})

export const CLIP_BODY_SCHEMA: Record<V1ClipToolName, z.ZodType> = {
  add_clip: addClipBodySchema,
  trim_clip: trimClipBodySchema,
  remove_clip: removeClipBodySchema,
}

const emptyToolCallOptions = () => ({ toolCallId: crypto.randomUUID(), messages: [] }) as never

const jsonFromToolOutcome = (
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

export const runV1ClipTool = async (
  access: ApiKeyAccess,
  toolName: V1ClipToolName,
  projectId: string,
  expectedRevision: number,
  input: Record<string, unknown>,
): Promise<{ outcome: ToolOutcome; project: StudioProject }> => {
  const { project, row } = await loadV1ProjectForKey(access, projectId)
  const { blobEnv } = getStudioClients()
  const ctx: StudioToolContext = {
    productId: access.productId,
    projectId,
    project,
    expectedRevision,
    supabase: access.supabase,
    blobEnv,
    modelProfileId: row.model_profile_id,
    persist: true,
    toolTrace: [],
  }
  const tools = createStudioTools(ctx)
  const tool = tools[toolName]
  if (!tool?.execute) {
    throw new Error(`Studio tool unavailable: ${toolName}`)
  }
  const outcome = (await tool.execute(input as never, emptyToolCallOptions())) as ToolOutcome
  if (ctx.toolTrace.length > 0) {
    await appendToolTraceEntries(access.supabase, projectId, ctx.toolTrace).catch(() => undefined)
  }
  return { outcome, project: ctx.project }
}

export const createV1ClipPostHandler = (toolName: V1ClipToolName) => async (request: Request) => {
  try {
    const access = await withApiKey(request)
    requireIdempotencyKey(request)
    const raw = await request.json().catch(() => ({}))
    const replay = await replayIfStored(request, access, raw)
    if (replay) return replay
    const parsed = CLIP_BODY_SCHEMA[toolName].parse(raw) as {
      projectId: string
      expectedRevision: number
    } & Record<string, unknown>
    const { projectId, expectedRevision, ...input } = parsed
    const { outcome, project } = await runV1ClipTool(
      access,
      toolName,
      projectId,
      expectedRevision,
      input,
    )
    return recordV1MutationIdempotency(
      request,
      access,
      raw,
      jsonFromToolOutcome(outcome, { project, tool: toolName }),
    )
  } catch (error) {
    return handleRouteError(error, `Failed to run ${toolName}`, (caught) => {
      const mapped = caught instanceof RevisionConflictError ? jsonError(caught.message, 409) : null
      if (mapped) return mapped
      if (caught instanceof z.ZodError) {
        return jsonError(caught.issues.map((issue) => issue.message).join('; '), 400)
      }
      const message = caught instanceof Error ? caught.message : ''
      if (message.includes('not found')) return jsonError(message, 404)
      return null
    })
  }
}
