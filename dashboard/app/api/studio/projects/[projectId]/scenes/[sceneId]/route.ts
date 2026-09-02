import { sceneRoleSchema } from '@synawood/creative/intent'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import {
  jsonFromToolOutcome,
  mapStudioRouteError,
  runStudioProjectTool,
} from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    role: sceneRoleSchema.optional(),
    label: z.string().min(1).max(160).optional(),
    intentNote: z.string().min(1).max(400).nullable().optional(),
    targetDurationFrames: z.number().int().positive().nullable().optional(),
    locked: z.boolean().optional(),
  })
  .strict()

const deleteSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
  })
  .strict()

/** PATCH — set_scene. */
export const PATCH = async (
  request: Request,
  context: { params: Promise<{ projectId: string; sceneId: string }> },
) => {
  try {
    const { projectId, sceneId } = await context.params
    const body = patchSchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { expectedRevision, ...patch } = body
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      expectedRevision,
      'set_scene',
      { sceneId, ...patch },
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to update scene', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}

/** DELETE — remove_scene (body: expectedRevision). */
export const DELETE = async (
  request: Request,
  context: { params: Promise<{ projectId: string; sceneId: string }> },
) => {
  try {
    const { projectId, sceneId } = await context.params
    const body = deleteSchema.parse(await request.json().catch(() => ({})))
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      body.expectedRevision,
      'remove_scene',
      { sceneId },
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to remove scene', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
