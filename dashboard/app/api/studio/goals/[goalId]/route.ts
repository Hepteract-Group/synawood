import {
  getCampaignGoal,
  listCampaignActionsForPlan,
  listCampaignPlansForGoal,
} from '@synawood/creative/goals'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ goalId: string }> }

export const GET = async (request: Request, { params }: Params) => {
  try {
    const { goalId } = await params
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const goal = await getCampaignGoal(access.supabase, { productId, goalId })
    if (!goal) return jsonError('Goal not found', 404)
    const plans = await listCampaignPlansForGoal(access.supabase, { productId, goalId })
    const actionsByPlan: Record<string, unknown[]> = {}
    for (const plan of plans) {
      actionsByPlan[plan.id] = await listCampaignActionsForPlan(access.supabase, {
        productId,
        planId: plan.id,
      })
    }
    return Response.json({ goal, plans, actionsByPlan })
  } catch (error) {
    return handleRouteError(error, 'Failed to load campaign goal')
  }
}
