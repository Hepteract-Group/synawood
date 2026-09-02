import { isBillingEnabled } from '@synawood/creative/billing/billing-mode'
import { sumCostEventsGbp } from '@synawood/creative/pricing'
import {
  getStudioClients,
  handleRouteError,
  jsonError,
  requireStudioAccess,
} from '@/lib/studio-server'

export const dynamic = 'force-dynamic'

const sinceDaysAgoIso = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

export type BillingUsage = {
  productId: string
  range: 'week' | 'month'
  projectId: string | null
  spentGbp: number
  billingEnabled: boolean
}

/** Member-readable CostEvent GBP rollup (#1047). */
export const GET = async (request: Request): Promise<Response> => {
  try {
    const url = new URL(request.url)
    const productId = url.searchParams.get('productId')?.trim() ?? ''
    const range = url.searchParams.get('range')?.trim() ?? 'month'
    const projectId = url.searchParams.get('projectId')?.trim() || null

    if (!productId) {
      return jsonError('productId is required', 400)
    }
    if (range !== 'week' && range !== 'month') {
      return jsonError('range must be week or month', 400)
    }

    const access = await requireStudioAccess({ productId, minRole: 'viewer' })

    if (!isBillingEnabled()) {
      return Response.json({
        productId: access.productId,
        range,
        projectId,
        spentGbp: 0,
        billingEnabled: false,
      } satisfies BillingUsage)
    }

    const { supabase } = getStudioClients()
    const sinceIso = sinceDaysAgoIso(range === 'week' ? 7 : 31)
    const spentGbp = await sumCostEventsGbp(supabase, {
      productId: access.productId,
      sinceIso,
      ...(projectId ? { projectId } : {}),
    })

    return Response.json({
      productId: access.productId,
      range,
      projectId,
      spentGbp,
      billingEnabled: true,
    } satisfies BillingUsage)
  } catch (err) {
    return handleRouteError(err, 'Failed to load billing usage')
  }
}
