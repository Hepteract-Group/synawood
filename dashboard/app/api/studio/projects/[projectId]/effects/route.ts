import { listTreatments } from '@synawood/creative/effects'
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

const bodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    action: z.enum(['apply', 'clear', 'regen']).default('apply'),
    clipId: z.string().min(1),
    effectId: z.string().min(1).max(80),
    intensity: z.number().min(0).max(1).optional(),
  })
  .strict()

/** GET primitives + clip treatments. POST apply_effect / clear_effect / regen_effect. */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { project } = await loadProject(access.supabase, projectId)
    return Response.json({
      primitives: listTreatments().map((item) => ({
        id: item.id,
        label: item.label,
        hint: item.hint,
      })),
      clips: project.clips.map((clip) => ({
        clipId: clip.id,
        treatments: clip.treatments ?? [],
      })),
      revision: project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not list effects.')
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
    const toolName = (
      { apply: 'apply_effect', clear: 'clear_effect', regen: 'regen_effect' } as const
    )[action]
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      expectedRevision,
      toolName,
      action === 'apply' ? input : { clipId: input.clipId, effectId: input.effectId },
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to apply treatment', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
