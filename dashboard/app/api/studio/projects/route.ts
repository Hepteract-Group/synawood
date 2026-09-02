import {
  createProject,
  listProjects,
  summarizeProject,
  parseStudioProject,
  normalizeCompositionId,
} from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) {
      return jsonError('productId is required', 400)
    }
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const { supabase } = access
    const rows = await listProjects(supabase, productId)
    const projects = rows.map((row) => {
      // Parent ↔ ad version link so Studio home can nest versions under their main cut.
      const lineage = {
        parentProjectId: row.parent_project_id ?? null,
        variantLabel: (row.variant_spec as { label?: string } | null)?.label ?? null,
      }
      try {
        const project = parseStudioProject({
          ...(typeof row.project_json === 'object' && row.project_json !== null
            ? row.project_json
            : {}),
          id: row.id,
          productId: row.product_id,
          compositionId: row.composition_id,
          status: row.status,
          revision: row.revision,
        })
        return { ...summarizeProject(project), ...lineage }
      } catch {
        return {
          id: row.id,
          productId: row.product_id,
          compositionId: row.composition_id,
          status: row.status,
          revision: row.revision,
          clipCount: 0,
          assetCount: 0,
          durationSeconds: 0,
          headline: row.composition_id,
          ...lineage,
        }
      }
    })
    return Response.json({ projects })
  } catch (error) {
    return handleRouteError(error, 'Failed to list projects')
  }
}

export const POST = async (request: Request) => {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      productId?: string
      compositionId?: string
      modelProfileId?: string
      name?: string
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return jsonError('name is required', 400)
    }
    if (name.length > 80) {
      return jsonError('name must be 80 characters or fewer', 400)
    }
    const productId = typeof body.productId === 'string' ? body.productId.trim() : ''
    if (!productId) {
      return jsonError('productId is required', 400)
    }
    const access = await requireStudioAccess({
      productId,
      minRole: 'editor',
    })
    const { supabase } = access
    const { project } = await createProject(supabase, {
      productId,
      compositionId: body.compositionId ? normalizeCompositionId(body.compositionId) : undefined,
      modelProfileId: body.modelProfileId,
      name,
    })
    return Response.json({ project, summary: summarizeProject(project) }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to create project')
  }
}
