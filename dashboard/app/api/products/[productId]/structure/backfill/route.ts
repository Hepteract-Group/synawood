import { backfillCreativeStructureForProduct } from '@synawood/creative/intent/backfill'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = async (
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const result = await backfillCreativeStructureForProduct(access.supabase, productId)
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Could not tag empty structure.')
  }
}
