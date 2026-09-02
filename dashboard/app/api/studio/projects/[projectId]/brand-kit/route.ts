import {
  clearProjectBrand,
  loadProject,
  RevisionConflictError,
  saveProject,
} from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({ expectedRevision: z.number().int().positive() })

export const DELETE = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access
    const { project } = await loadProject(supabase, projectId)
    const { project: saved } = await saveProject(
      supabase,
      clearProjectBrand(project),
      body.expectedRevision,
    )
    return Response.json({ project: saved })
  } catch (error) {
    return handleRouteError(error, 'Failed to clear brand', (error) => {
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
