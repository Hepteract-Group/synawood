import { sceneRoleSchema } from '@synawood/creative/intent'
import { loadProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import {
  jsonFromToolOutcome,
  mapStudioRouteError,
  runStudioProjectTool,
} from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const addSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    role: sceneRoleSchema,
    label: z.string().min(1).max(160),
    intentNote: z.string().min(1).max(400).optional(),
    targetDurationFrames: z.number().int().positive().optional(),
    clipIds: z.array(z.string().min(1)).optional(),
    overlayIds: z.array(z.string().min(1)).optional(),
    locked: z.boolean().optional(),
    index: z.number().int().nonnegative().optional(),
  })
  .strict()

/** GET — current scene tree. */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { project } = await loadProject(access.supabase, projectId)
    return Response.json({ scenes: project.scenes ?? [], revision: project.revision })
  } catch (error) {
    return handleRouteError(error, 'Failed to load scenes')
  }
}

/** POST — add_scene. */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = addSchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { expectedRevision, ...input } = body
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      expectedRevision,
      'add_scene',
      input,
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to add scene', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
