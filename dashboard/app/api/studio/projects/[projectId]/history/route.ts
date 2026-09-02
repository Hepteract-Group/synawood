import {
  loadProject,
  redoProject,
  resolveHistoryMeta,
  RevisionConflictError,
  seedCurrentRevision,
  undoProject,
} from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({
  expectedRevision: z.number().int().positive(),
  action: z.enum(['undo', 'redo']),
})

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access

    const result =
      body.action === 'undo'
        ? await undoProject(supabase, projectId, body.expectedRevision)
        : await redoProject(supabase, projectId, body.expectedRevision)

    return Response.json({
      project: result.project,
      history: result.history,
      row: {
        modelProfileId: result.row.model_profile_id,
        revision: result.row.revision,
        historyTip: result.row.history_tip ?? result.row.revision,
      },
    })
  } catch (error) {
    return handleRouteError(error, 'History action failed', (error) => {
      if (error instanceof RevisionConflictError) {
        return jsonError(error.message, 409)
      }
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { supabase } = access
    const { row, project } = await loadProject(supabase, projectId)
    await seedCurrentRevision(supabase, row, project)
    const history = await resolveHistoryMeta(supabase, projectId, {
      revision: project.revision,
      history_tip: row.history_tip ?? project.revision,
    })
    return Response.json({ history, revision: project.revision })
  } catch (error) {
    return handleRouteError(error, 'Failed to load history')
  }
}
