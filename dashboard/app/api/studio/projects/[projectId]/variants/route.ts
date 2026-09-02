import { listVariantChildren } from '@synawood/creative/variant'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const rows = await listVariantChildren(access.supabase, projectId)
    return Response.json({
      children: rows.map((row) => ({
        id: row.id,
        name: (row.project_json as { name?: string } | null)?.name ?? null,
        status: row.status,
        variantSpec: row.variant_spec ?? null,
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to list variants')
  }
}
