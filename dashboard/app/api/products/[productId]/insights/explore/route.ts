import { NextResponse } from 'next/server'
import { listCreativePerformance, listIntegrations } from '@synawood/creative/performance'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    let integrations: Awaited<ReturnType<typeof listIntegrations>> = []
    try {
      integrations = await listIntegrations(access.supabase, productId)
    } catch {
      integrations = []
    }
    let performance: Awaited<ReturnType<typeof listCreativePerformance>> = []
    let performanceUnavailable = false
    try {
      performance = await listCreativePerformance(access.supabase, productId)
    } catch {
      performanceUnavailable = true
    }
    return NextResponse.json({ performance, integrations, performanceUnavailable })
  } catch (error) {
    return handleRouteError(error, 'Could not load Final rollup.')
  }
}
