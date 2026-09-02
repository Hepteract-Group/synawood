import {
  loadProject,
  removeAsset,
  renameAsset,
  RevisionConflictError,
  saveProject,
} from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const deleteBodySchema = z.object({ expectedRevision: z.number().int().positive() })

const patchBodySchema = z.object({
  expectedRevision: z.number().int().positive(),
  name: z.string().trim().min(1).max(80),
})

export const PATCH = async (
  request: Request,
  context: { params: Promise<{ projectId: string; assetId: string }> },
) => {
  try {
    const { projectId, assetId } = await context.params
    const body = patchBodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access
    const { project } = await loadProject(supabase, projectId)
    const { project: saved } = await saveProject(
      supabase,
      renameAsset(project, assetId, body.name),
      body.expectedRevision,
    )
    return Response.json({ project: saved })
  } catch (error) {
    return handleRouteError(error, 'Failed to rename asset', (error) => {
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

export const DELETE = async (
  request: Request,
  context: { params: Promise<{ projectId: string; assetId: string }> },
) => {
  try {
    const { projectId, assetId } = await context.params
    const body = deleteBodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access
    const { project } = await loadProject(supabase, projectId)
    const { project: saved } = await saveProject(
      supabase,
      removeAsset(project, assetId),
      body.expectedRevision,
    )
    return Response.json({ project: saved })
  } catch (error) {
    return handleRouteError(error, 'Failed to remove asset', (error) => {
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
