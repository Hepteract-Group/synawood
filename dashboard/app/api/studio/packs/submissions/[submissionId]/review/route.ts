import { reviewPackSubmission } from '@synawood/creative/packs/catalog'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ submissionId: string }> }

/** Approve or reject a queued pack submission (product owner / curator). */
export const POST = async (request: Request, { params }: Params) => {
  try {
    const { submissionId } = await params
    const body = (await request.json()) as {
      productId?: string
      decision?: 'approved' | 'rejected'
      curatorNote?: string
      publisher?: string
    }
    const productId = body.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (body.decision !== 'approved' && body.decision !== 'rejected') {
      return jsonError('decision must be approved or rejected', 400)
    }

    const access = await requireStudioAccess({ productId, minRole: 'owner' })
    const result = await reviewPackSubmission(access.supabase, {
      submissionId,
      decision: body.decision,
      curatorNote: body.curatorNote,
      publisher: body.publisher,
    })
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to review pack submission')
  }
}
