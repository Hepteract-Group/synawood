import { readCreativeBudgets, sumCostEventsGbp } from '@synawood/creative/pricing'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

const sinceDaysAgoIso = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { supabase, productId } = access
    const budgets = readCreativeBudgets()
    const [month, week, project] = await Promise.all([
      sumCostEventsGbp(supabase, { productId, sinceIso: sinceDaysAgoIso(31) }),
      sumCostEventsGbp(supabase, { productId, sinceIso: sinceDaysAgoIso(7) }),
      sumCostEventsGbp(supabase, {
        productId,
        projectId,
        sinceIso: sinceDaysAgoIso(365),
      }),
    ])
    return Response.json({
      productId,
      projectId,
      spent: { monthGbp: month, weekGbp: week, projectGbp: project },
      budgets,
      remainingMonthlyGbp: Math.max(0, budgets.monthlyGeneratorCap - month),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load costs')
  }
}
