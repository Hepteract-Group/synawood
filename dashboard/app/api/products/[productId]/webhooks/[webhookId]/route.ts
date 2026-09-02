import { NextResponse } from 'next/server'
import { API_KEY_OWNER_ONLY_COPY } from '@/lib/api-console-copy'
import { revokeProductWebhook } from '@/lib/product-webhooks'
import { ProductAccessError } from '@/lib/product-membership'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ productId: string; webhookId: string }> }

export const POST = async (_request: Request, context: RouteContext) => {
  try {
    const { productId, webhookId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'owner' })
    if (access.membership.role !== 'owner') {
      throw new ProductAccessError(API_KEY_OWNER_ONLY_COPY, 403)
    }
    const webhook = await revokeProductWebhook({
      supabase: access.supabase,
      productId,
      webhookId,
    })
    return NextResponse.json({ webhook })
  } catch (error) {
    return handleRouteError(error, 'Could not revoke webhook.')
  }
}
