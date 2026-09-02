import { approveCampaignAction, dispatchCampaignAction } from '@synawood/creative/goals/dispatch'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ actionId: string }> }

/** Approve or reject a gated action (#303). */
export const POST = async (request: Request, { params }: Params) => {
  try {
    const { actionId } = await params
    const body = (await request.json()) as {
      productId?: string
      approve?: boolean
      dispatch?: boolean
    }
    const productId = body.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (typeof body.approve !== 'boolean') return jsonError('approve boolean is required', 400)

    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    let action = await approveCampaignAction(access.supabase, {
      productId,
      actionId,
      approvedBy: access.userId,
      approve: body.approve,
    })
    if (body.approve && body.dispatch === true) {
      action = await dispatchCampaignAction(access.supabase, {
        productId,
        actionId,
        actorUserId: access.userId,
      })
    }
    return Response.json({ action })
  } catch (error) {
    return handleRouteError(error, 'Failed to review campaign action')
  }
}
