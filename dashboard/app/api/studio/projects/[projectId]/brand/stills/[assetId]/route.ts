import { removeBrandStillAsset } from '@synawood/creative/brand'
import { loadProject, RevisionConflictError, saveProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({ expectedRevision: z.number().int().positive() })

export const DELETE = async (
  request: Request,
  context: { params: Promise<{ projectId: string; assetId: string }> },
) => {
  try {
    const { projectId, assetId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access
    const { project } = await loadProject(supabase, projectId)
    const next = removeBrandStillAsset(project, assetId)
    const forSave = { ...next, revision: project.revision }
    const saved = await saveProject(supabase, forSave, body.expectedRevision)
    return Response.json({ project: saved.project, brand: saved.project.brand })
  } catch (error) {
    return handleRouteError(error, 'Failed to remove brand still', (err) => {
      if (err instanceof RevisionConflictError) {
        return jsonError(err.message, 409)
      }
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
