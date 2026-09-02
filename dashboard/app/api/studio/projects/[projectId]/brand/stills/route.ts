import { addBrandStillAsset, uploadBrandImageAsset } from '@synawood/creative/brand'
import { loadProject, saveProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase, blobEnv } = access
    const form = await request.formData()
    const file = form.get('file')
    const expectedRevision = Number(form.get('expectedRevision'))
    const makePrimary = String(form.get('makePrimary') ?? 'false') === 'true'
    if (!(file instanceof File)) {
      return jsonError('file is required', 400)
    }
    if (!Number.isFinite(expectedRevision) || expectedRevision < 1) {
      return jsonError('expectedRevision is required', 400)
    }
    const { project } = await loadProject(supabase, projectId)
    const bytes = Buffer.from(await file.arrayBuffer())
    const contentType = file.type || 'application/octet-stream'
    const { asset } = await uploadBrandImageAsset({
      supabase,
      blobEnv,
      project,
      fileName: file.name || 'still.png',
      contentType,
      data: bytes,
      probe: { role: 'still' },
    })
    const next = addBrandStillAsset(project, asset, { makePrimary })
    const forSave = { ...next, revision: project.revision }
    const saved = await saveProject(supabase, forSave, expectedRevision)
    return Response.json({ project: saved.project, brand: saved.project.brand, asset })
  } catch (error) {
    return handleRouteError(error, 'Failed to upload brand still', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
