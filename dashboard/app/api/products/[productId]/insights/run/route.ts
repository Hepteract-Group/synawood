import { NextResponse } from 'next/server'
import { runLearningWorker } from '@synawood/creative/learning'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = async (
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const result = await runLearningWorker(access.supabase, productId)
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, 'Could not run analyses.')
  }
}
