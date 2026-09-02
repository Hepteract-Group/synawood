import { dispatchCampaignAction } from '@synawood/creative/goals/dispatch'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ actionId: string }> }

/** Run an approved action through the dispatcher (#302). */
export const POST = async (request: Request, { params }: Params) => {
  try {
    const { actionId } = await params
    const body = (await request.json()) as { productId?: string }
    const productId = body.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const action = await dispatchCampaignAction(access.supabase, {
      productId,
      actionId,
      actorUserId: access.userId,
    })
    return Response.json({ action })
  } catch (error) {
    return handleRouteError(error, 'Failed to dispatch campaign action')
  }
}
