import { loadProject, overlayLayoutSchema, overlayStyleSchema } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import {
  jsonFromToolOutcome,
  mapStudioRouteError,
  runStudioProjectTool,
} from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const addTextBodySchema = z
  .object({
    action: z.literal('add_text'),
    expectedRevision: z.number().int().positive(),
    text: z.string().min(1).max(240),
    kind: z.enum(['title', 'hook_title', 'end_card', 'lower_third']).optional(),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
    layout: overlayLayoutSchema.optional(),
    style: overlayStyleSchema.optional(),
    libraryItemId: z.string().min(1).optional(),
  })
  .strict()

const updateOverlayBodySchema = z
  .object({
    action: z.literal('update_overlay'),
    expectedRevision: z.number().int().positive(),
    overlayId: z.string().min(1),
    text: z.string().min(1).max(400).optional(),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
    layout: overlayLayoutSchema.optional(),
    style: overlayStyleSchema.nullable().optional(),
    libraryItemId: z.string().min(1).nullable().optional(),
  })
  .strict()

const bodySchema = z.discriminatedUnion('action', [addTextBodySchema, updateOverlayBodySchema])

/** GET current overlays. POST add_text or update_overlay. */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { project } = await loadProject(access.supabase, projectId)
    return Response.json({
      projectId,
      overlays: project.overlays,
      revision: project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not list overlays.')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { expectedRevision, action, ...input } = body
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      expectedRevision,
      action,
      input,
    )
    return jsonFromToolOutcome(outcome, {
      project,
      overlays: project.overlays,
      traceWarning,
    })
  } catch (error) {
    return handleRouteError(error, 'Overlay mutation failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
