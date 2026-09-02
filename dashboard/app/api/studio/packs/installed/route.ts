import { listProductInstalls } from '@synawood/creative/packs/catalog'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** List installed agent packs for a product (#291). */
export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const installs = await listProductInstalls(access.supabase, productId, access.userId)
    return Response.json({ installs })
  } catch (error) {
    return handleRouteError(error, 'Failed to list installed packs')
  }
}
