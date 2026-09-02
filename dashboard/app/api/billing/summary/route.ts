import { isBillingEnabled } from '@synawood/creative/billing/billing-mode'
import { loadHostedSpendContext } from '@synawood/creative/billing/load-hosted-spend-context'
import { maxMonthlyCapGbp } from '@synawood/creative/billing/monthly-cap'
import { HOSTED_PLANS, type HostedPlanId } from '@synawood/creative/billing/plans'
import {
  getStudioClients,
  handleRouteError,
  jsonError,
  requireStudioAccess,
} from '@/lib/studio-server'

export const dynamic = 'force-dynamic'

export type BillingSummary = {
  billingEnabled: boolean
  walletBalanceGbp: number
  generationFrozen: boolean
  hasWallet: boolean
  monthlyCapGbp: number | null
  maxAllowedCapGbp: number | null
  spentThisPeriodFromWalletGbp: number
  spentThisWeekGbp: number
  spentThisMonthGbp: number
  planId: string | null
  trialEndsAt: string | null
  seatLimit: number | null
  seatsUsed: number | null
  paidHostedVideo: boolean | null
  watermarkExports: boolean | null
  role: string | null
}

const emptySummary = (role: string | null): BillingSummary => ({
  billingEnabled: false,
  walletBalanceGbp: 0,
  generationFrozen: false,
  hasWallet: false,
  monthlyCapGbp: null,
  maxAllowedCapGbp: null,
  spentThisPeriodFromWalletGbp: 0,
  spentThisWeekGbp: 0,
  spentThisMonthGbp: 0,
  planId: null,
  trialEndsAt: null,
  seatLimit: null,
  seatsUsed: null,
  paidHostedVideo: null,
  watermarkExports: null,
  role,
})

const planExtras = (planId: string | null) => {
  if (!planId || !(planId in HOSTED_PLANS)) {
    return { paidHostedVideo: null, watermarkExports: null }
  }
  const plan = HOSTED_PLANS[planId as HostedPlanId]
  return {
    paidHostedVideo: plan.paidHostedVideo,
    watermarkExports: plan.watermarkExports,
  }
}

export const GET = async (request: Request): Promise<Response> => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim() ?? ''
    if (!productId) {
      return jsonError('productId is required', 400)
    }

    if (!isBillingEnabled()) {
      const access = await requireStudioAccess({ productId, minRole: 'viewer' })
      return Response.json(emptySummary(access.membership.role) satisfies BillingSummary)
    }

    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const { supabase } = getStudioClients()

    const ctx = await loadHostedSpendContext(supabase, { productId: access.productId })
    const { count: seatsUsedCount, error: seatsError } = await supabase
      .from('product_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('product_id', access.productId)
    if (seatsError) {
      throw new Error(`Failed to count seats: ${seatsError.message}`)
    }
    const maxAllowedCapGbp = ctx.hasWallet
      ? maxMonthlyCapGbp({
          walletBalanceGbp: ctx.walletBalanceGbp,
          spentThisPeriodFromWalletGbp: ctx.spentThisMonthFromWalletGbp,
        })
      : null
    const extras = planExtras(ctx.planId)

    return Response.json({
      billingEnabled: true,
      walletBalanceGbp: ctx.walletBalanceGbp,
      generationFrozen: ctx.generationFrozen,
      hasWallet: ctx.hasWallet,
      monthlyCapGbp: ctx.monthlyGeneratorCapGbp,
      maxAllowedCapGbp,
      spentThisPeriodFromWalletGbp: ctx.spentThisMonthFromWalletGbp,
      spentThisWeekGbp: ctx.spentThisWeekGbp,
      spentThisMonthGbp: ctx.spentThisMonthGbp,
      planId: ctx.planId,
      trialEndsAt: ctx.trialEndsAt,
      seatLimit: ctx.seatLimit,
      seatsUsed: seatsUsedCount ?? 0,
      paidHostedVideo: extras.paidHostedVideo,
      watermarkExports: extras.watermarkExports,
      role: access.membership.role,
    } satisfies BillingSummary)
  } catch (err) {
    return handleRouteError(err, 'Failed to load billing summary')
  }
}
