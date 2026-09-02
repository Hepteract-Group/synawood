import { NextResponse } from 'next/server'
import { API_KEY_OWNER_ONLY_COPY } from '@/lib/api-console-copy'
import { revokeProductApiKey } from '@/lib/product-api-keys'
import { ProductAccessError } from '@/lib/product-membership'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ productId: string; keyId: string }> }

/** Owner revoke — row stays listed with revokedAt set. */
export const POST = async (_request: Request, context: RouteContext) => {
  try {
    const { productId, keyId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'owner' })
    if (access.membership.role !== 'owner') {
      throw new ProductAccessError(API_KEY_OWNER_ONLY_COPY, 403)
    }
    const key = await revokeProductApiKey({
      supabase: access.supabase,
      productId,
      keyId,
    })
    return NextResponse.json({ key })
  } catch (error) {
    return handleRouteError(error, 'Could not revoke API key.')
  }
}
