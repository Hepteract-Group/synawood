import {
  listActiveRevocationsForProduct,
  syncPackRevocations,
} from '@synawood/creative/packs/revocation'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** List revocations that affect this product's installs (banner source). */
export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url)
    const productId = url.searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const revocations = await listActiveRevocationsForProduct(access.supabase, productId)
    return Response.json({ revocations })
  } catch (error) {
    return handleRouteError(error, 'Failed to list pack revocations')
  }
}

/** Apply revocation events → disable matching installs. */
export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as { productId?: string; sinceIso?: string | null }
    const productId = body.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const result = await syncPackRevocations(access.supabase, {
      productId,
      sinceIso: body.sinceIso ?? null,
    })
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to sync pack revocations')
  }
}
