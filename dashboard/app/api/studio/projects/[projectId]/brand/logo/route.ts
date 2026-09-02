import { recordBillingEventOnceBestEffort } from '@synawood/creative/billing/events'
import { setBrandLogoAsset, uploadBrandImageAsset } from '@synawood/creative/brand'
import { patchReadyBriefBrandCandidates } from '@synawood/creative/brief'
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
    const roleRaw = String(form.get('role') ?? 'primary')
    const role = roleRaw === 'mono' ? 'mono' : 'primary'
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
      fileName: file.name || 'logo.png',
      contentType,
      data: bytes,
      probe: { role: role === 'mono' ? 'logo-mono' : 'logo' },
    })
    const next = setBrandLogoAsset(project, { asset, role })
    const forSave = { ...next, revision: project.revision }
    const saved = await saveProject(supabase, forSave, expectedRevision)
    // Keep ready extract brief in sync so Apply doesn't resurrect the wrong logo.
    if (role === 'primary') {
      await patchReadyBriefBrandCandidates(supabase, projectId, { logoAssetId: asset.id })
      await recordBillingEventOnceBestEffort(supabase, {
        productId: project.productId,
        name: 'brand_logo_set',
        payload: { projectId, assetId: asset.id },
      })
    }
    return Response.json({ project: saved.project, brand: saved.project.brand, asset })
  } catch (error) {
    return handleRouteError(error, 'Failed to upload brand logo', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
