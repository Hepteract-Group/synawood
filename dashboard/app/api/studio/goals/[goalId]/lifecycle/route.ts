import { setCampaignGoalLifecycle } from '@synawood/creative/goals/lifecycle'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ goalId: string }> }

/** Pause / resume / kill / complete a goal (#305). */
export const POST = async (request: Request, { params }: Params) => {
  try {
    const { goalId } = await params
    const body = (await request.json()) as {
      productId?: string
      status?: 'active' | 'paused' | 'killed' | 'completed'
    }
    const productId = body.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (
      body.status !== 'active' &&
      body.status !== 'paused' &&
      body.status !== 'killed' &&
      body.status !== 'completed'
    ) {
      return jsonError('status must be active|paused|killed|completed', 400)
    }
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const goal = await setCampaignGoalLifecycle(access.supabase, {
      productId,
      goalId,
      status: body.status,
    })
    return Response.json({ goal })
  } catch (error) {
    return handleRouteError(error, 'Failed to update goal lifecycle')
  }
}
