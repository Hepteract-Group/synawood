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
    preserveClipOrder: z.boolean().optional(),
  })
  .strict()

/**
 * POST — plan_scenes (draft only; does not write project.scenes).
 * Uses current revision for tool context (read-only heuristic).
 */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { project } = await loadProject(access.supabase, projectId)
    const { outcome, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      project.revision,
      'plan_scenes',
      body,
    )
    return jsonFromToolOutcome(outcome, { revision: project.revision, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to plan scenes', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
