import { NextResponse } from 'next/server'
import { listInsights, sendInsightsDigest } from '@synawood/creative/learning'
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
    const insights = await listInsights(access.supabase, productId, 'open')
    const result = await sendInsightsDigest({
      productId,
      insights: insights.map((row) => ({ title: row.title as string, body: row.body as string })),
    })
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, 'Could not build digest.')
  }
}
