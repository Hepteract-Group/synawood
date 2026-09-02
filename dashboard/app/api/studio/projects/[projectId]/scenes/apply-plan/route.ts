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
    scenes: z.array(z.record(z.string(), z.unknown())).min(1),
  })
  .strict()

/** POST — apply_scene_plan. */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      body.expectedRevision,
      'apply_scene_plan',
      { scenes: body.scenes },
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to apply scene plan', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
