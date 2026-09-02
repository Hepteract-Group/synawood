import { buildCampaignRetrospective } from '@synawood/creative/goals/retrospective'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ goalId: string }> }

/** Retrospective insight for a goal (#307). */
export const GET = async (request: Request, { params }: Params) => {
  try {
    const { goalId } = await params
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const retrospective = await buildCampaignRetrospective(access.supabase, {
      productId,
      goalId,
    })
    return Response.json({ retrospective })
  } catch (error) {
    return handleRouteError(error, 'Failed to build retrospective')
  }
}
