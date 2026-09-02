import { isPlaceExtractError, placeProductExtractOnProject } from '@synawood/creative/extract'
import { loadProject, RevisionConflictError, saveProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  expectedRevision: z.number().int().positive(),
})

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string; extractId: string }> },
) => {
  try {
    const { projectId, extractId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access
    const { project } = await loadProject(supabase, projectId)
    const placed = await placeProductExtractOnProject({
      supabase,
      project,
      extractId,
    })
    const { project: saved } = await saveProject(supabase, placed.project, body.expectedRevision)
    return Response.json({
      project: saved,
      assetId: placed.asset.id,
      clipId: placed.clipId,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to place extract', (err) => {
      if (err instanceof RevisionConflictError) {
        return jsonError(err.message, 409)
      }
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      if (isPlaceExtractError(err)) {
        return jsonError(err.message, err.status)
      }
      return null
    })
  }
}
