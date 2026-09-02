import { NextResponse } from 'next/server'
import { listInsights } from '@synawood/creative/learning'
import { listIntegrations } from '@synawood/creative/performance'
import { insightStatusSchema } from '@synawood/creative/learning/schema'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (
  request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const statusParam = new URL(request.url).searchParams.get('status')
    const parsedStatus = statusParam ? insightStatusSchema.safeParse(statusParam) : null
    const status = parsedStatus?.success ? parsedStatus.data : undefined
    let insights: Awaited<ReturnType<typeof listInsights>> = []
    let insightsUnavailable = false
    try {
      insights = await listInsights(access.supabase, productId, status)
    } catch {
      insightsUnavailable = true
    }
    let integrations: Awaited<ReturnType<typeof listIntegrations>> = []
    try {
      integrations = await listIntegrations(access.supabase, productId)
    } catch {
      integrations = []
    }
    return NextResponse.json({ insights, integrations, insightsUnavailable })
  } catch (error) {
    return handleRouteError(error, 'Could not load insights.')
  }
}
