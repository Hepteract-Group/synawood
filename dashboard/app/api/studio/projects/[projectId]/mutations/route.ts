import { appendToolTraceEntries } from '@synawood/creative/agent'
import {
  applyStudioMutation,
  loadProject,
  resolveHistoryMeta,
  RevisionConflictError,
  studioMutationSchema,
  summarizeStudioMutation,
} from '@synawood/creative/project'
import {
  applyProjectMutation,
  recordToolTrace,
  toolOk,
  type StudioToolContext,
} from '@synawood/creative/tools'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({
  expectedRevision: z.number().int().positive(),
  mutation: studioMutationSchema,
})

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase, blobEnv } = access
    const { project, row } = await loadProject(supabase, projectId)
    const mutation = body.mutation
    const toolContext: StudioToolContext = {
      productId: project.productId,
      projectId,
      project,
      expectedRevision: body.expectedRevision,
      supabase,
      blobEnv,
      modelProfileId: row.model_profile_id,
      persist: true,
      toolTrace: [],
    }
    const { project: saved } = await applyProjectMutation(toolContext, (current) =>
      applyStudioMutation(current, mutation),
    )
    const { row: latestRow } = await loadProject(supabase, projectId)
    const history = await resolveHistoryMeta(supabase, projectId, {
      revision: saved.revision,
      history_tip: latestRow.history_tip ?? saved.revision,
    })
    const traceEntry = recordToolTrace(
      toolContext,
      mutation.type,
      mutation,
      toolOk(summarizeStudioMutation(mutation), {
        revision: saved.revision,
        source: 'timeline',
      }),
    )
    let traceWarning: string | undefined
    try {
      await appendToolTraceEntries(supabase, projectId, [traceEntry])
    } catch (traceError) {
      traceWarning =
        traceError instanceof Error ? traceError.message : 'Failed to persist manual edit trace'
    }
    return Response.json({ project: saved, history, traceEntry, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Timeline mutation failed', (error) => {
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
