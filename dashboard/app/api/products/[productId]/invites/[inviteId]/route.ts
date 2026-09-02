import { NextResponse } from 'next/server'
import { revokeProductInvite } from '../../../../../../lib/product-onboarding'
import { handleRouteError, requireStudioAccess } from '../../../../../../lib/studio-server'

type RouteContext = { params: Promise<{ productId: string; inviteId: string }> }

/** Owner revokes a pending invite. */
export const DELETE = async (_request: Request, context: RouteContext) => {
  try {
    const { productId, inviteId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'owner' })
    await revokeProductInvite(access.supabase, {
      productId,
      inviteId,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not revoke invite.')
  }
}
