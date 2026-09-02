import { planCampaignForGoal } from '@synawood/creative/goals'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ goalId: string }> }

/** HTTP path for plan_campaign (#301) without requiring a Studio project chat turn. */
export const POST = async (request: Request, { params }: Params) => {
  try {
    const { goalId } = await params
    const body = (await request.json()) as {
      productId?: string
      planTitle?: string
      planSummary?: string
    }
    const productId = body.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const result = await planCampaignForGoal(access.supabase, {
      productId,
      goalId,
      planTitle: body.planTitle,
      planSummary: body.planSummary,
    })
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to plan campaign')
  }
}
