import {
  isMarketplaceAdaptersEnabled,
  listMarketplaceAdapters,
} from '@synawood/creative/marketplace'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Marketplace status (#153). Flagged stubs only — no search/purchase in Wave 2B.
 * Wave 2G will add real adapters behind the same port.
 */
export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) {
      return Response.json({ error: 'productId is required' }, { status: 400 })
    }
    await requireStudioAccess({ productId, minRole: 'viewer' })

    const enabled = isMarketplaceAdaptersEnabled()
    const adapters = listMarketplaceAdapters().map((adapter) => ({
      providerId: adapter.providerId,
      label: adapter.label,
      kinds: [...adapter.kinds],
    }))

    return Response.json({
      enabled,
      adapters,
      note: enabled
        ? 'Stub adapters only — search/purchase are not implemented (Wave 2G).'
        : 'Marketplace adapters are off (MARKETPLACE_ADAPTERS).',
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load marketplace status')
  }
}
