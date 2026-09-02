import {
  loadProject,
  RevisionConflictError,
  isCampaignPackComposition,
} from '@synawood/creative/project'
import {
  approveCampaignCreatives,
  approveProject,
  killProject,
  regenerateProject,
} from '@synawood/creative/review'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({
  action: z.enum(['approve', 'kill', 'regenerate']),
  expectedRevision: z.number().int().positive(),
  selectedCreativeIds: z.array(z.string().min(1)).optional(),
  channel: z.string().min(1).optional(),
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

    if (body.action === 'approve') {
      if (
        isCampaignPackComposition(project.compositionId) &&
        body.selectedCreativeIds &&
        body.selectedCreativeIds.length > 0
      ) {
        const result = await approveCampaignCreatives(
          supabase,
          blobEnv,
          project,
          body.expectedRevision,
          {
            creativeIds: body.selectedCreativeIds,
            channel: body.channel,
          },
        )
        return Response.json({
          project: result.project,
          finals: result.finals,
          alreadyApproved: result.finals.every((row) => row.alreadyApproved),
        })
      }
      const result = await approveProject(supabase, blobEnv, project, body.expectedRevision, {
        parentProjectId: row.parent_project_id,
        variantSpec: row.variant_spec,
      })
      return Response.json({
        project: result.project,
        finalAsset: result.finalAsset,
        alreadyApproved: result.alreadyApproved,
      })
    }
    if (body.action === 'kill') {
      const saved = await killProject(supabase, project, body.expectedRevision)
      return Response.json({ project: saved })
    }
    const saved = await regenerateProject(supabase, project, body.expectedRevision)
    return Response.json({ project: saved })
  } catch (error) {
    return handleRouteError(error, 'Review action failed', (error) => {
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
