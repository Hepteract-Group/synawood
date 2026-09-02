import { createCampaignGoal, listCampaignGoals } from '@synawood/creative/goals'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** List / create campaign goals (ADR-0040 / #299). */
export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const goals = await listCampaignGoals(access.supabase, productId)
    return Response.json({ goals })
  } catch (error) {
    return handleRouteError(error, 'Failed to list campaign goals')
  }
}

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as {
      productId?: string
      title?: string
      outcome?: string
      successMetric?: string
    }
    const productId = body.productId?.trim()
    const title = body.title?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (!title) return jsonError('title is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const goal = await createCampaignGoal(access.supabase, {
      productId,
      title,
      outcome: body.outcome?.trim() ?? '',
      successMetric: body.successMetric?.trim() ?? '',
      createdBy: access.userId,
    })
    return Response.json({ goal }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to create campaign goal')
  }
}
