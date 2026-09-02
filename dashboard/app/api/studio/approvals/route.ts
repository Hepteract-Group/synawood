import { listOpenApprovalRuns } from '@synawood/creative/governance'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const runs = await listOpenApprovalRuns(access.supabase, productId)
    return Response.json({ runs })
  } catch (error) {
    return handleRouteError(error, 'Failed to list approvals')
  }
}
