import { RevisionConflictError } from '@synawood/creative/project'
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
    expectedRevision: z.number().int().nonnegative(),
    clipId: z.string().min(1).optional(),
  })
  .strict()

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
      'duck_music',
      { clipId: body.clipId },
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Could not duck music under speech', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      if (err instanceof RevisionConflictError) {
        return mapStudioRouteError(err)
      }
      return mapStudioRouteError(err)
    })
  }
}
