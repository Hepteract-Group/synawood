import { allowUnsignedPacksFromEnv, seedStarterPacks } from '@synawood/creative/packs'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Publish in-repo Hepteract starter packs (local/dev unsigned path only).
 * Not available when unsigned installs are disabled.
 */
export const POST = async (request: Request) => {
  try {
    if (!allowUnsignedPacksFromEnv()) {
      return jsonError('Starter pack publishing is only available in local unsigned mode.', 403)
    }
    const body = (await request.json()) as { productId?: string }
    const productId = body.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'owner' })
    const published = await seedStarterPacks({
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      productId,
    })
    return Response.json({ published }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to publish starter packs')
  }
}
