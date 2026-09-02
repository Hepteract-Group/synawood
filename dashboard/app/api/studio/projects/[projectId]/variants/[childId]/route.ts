import { loadProject } from '@synawood/creative/project'
import { saveVariantChildOverrides } from '@synawood/creative/variant'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    hookText: z.string().min(1).max(120),
    ctaText: z.string().min(1).max(160),
    expectedRevision: z.number().int().positive(),
  })
  .strict()

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string; childId: string }> },
) => {
  try {
    const { projectId: parentProjectId, childId } = await context.params
    const body = bodySchema.parse(await request.json())
    await requireStudioAccess({ projectId: parentProjectId, minRole: 'editor' })
    // Also require editor on the child (same product via lookup).
    const access = await requireStudioAccess({ projectId: childId, minRole: 'editor' })

    const result = await saveVariantChildOverrides({
      supabase: access.supabase,
      parentProjectId,
      childProjectId: childId,
      hookText: body.hookText,
      ctaText: body.ctaText,
      expectedRevision: body.expectedRevision,
    })

    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to save variant overrides', (err) => {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('revision conflict')) return jsonError(message, 409)
      if (message.includes('does not belong') || message.includes('required')) {
        return jsonError(message, 400)
      }
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}

/** Load child revision + current overlay copy for the overrides drawer. */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string; childId: string }> },
) => {
  try {
    const { projectId: parentProjectId, childId } = await context.params
    const access = await requireStudioAccess({ projectId: childId, minRole: 'viewer' })
    const { project, row } = await loadProject(access.supabase, childId)
    if (row.parent_project_id !== parentProjectId) {
      return jsonError('Variant child does not belong to this parent project', 400)
    }
    const hook = project.overlays.find((o) => o.kind === 'hook_title')?.text ?? ''
    const cta = project.overlays.find((o) => o.kind === 'end_card')?.text ?? ''
    return Response.json({
      childId,
      revision: project.revision,
      hookText: hook,
      ctaText: cta,
      variantSpec: row.variant_spec ?? null,
      name: project.name ?? null,
      status: project.status,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load variant child')
  }
}
