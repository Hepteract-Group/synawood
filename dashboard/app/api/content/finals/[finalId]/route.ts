import {
  emptyCreativeStructure,
  type CreativeStructure,
} from '@synawood/creative/intent/creative-structure'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (_request: Request, context: { params: Promise<{ finalId: string }> }) => {
  try {
    const { finalId } = await context.params
    const access = await requireStudioAccess({ finalAssetId: finalId, minRole: 'viewer' })
    const { data, error } = await access.supabase
      .from('final_assets')
      .select('id, product_id, project_id, created_at, creative_structure, attribution')
      .eq('id', finalId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return Response.json({ error: 'Final not found.' }, { status: 404 })
    const structure =
      (data.creative_structure as CreativeStructure | null) ?? emptyCreativeStructure()
    return Response.json({
      final: {
        id: data.id,
        productId: data.product_id,
        projectId: data.project_id,
        createdAt: data.created_at,
        creativeStructure: structure,
        attribution: data.attribution ?? {},
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load Final snapshot.')
  }
}
