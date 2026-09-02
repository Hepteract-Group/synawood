import { isBillingEnabled } from '@synawood/creative/billing/billing-mode'
import { loadHostedSpendContext } from '@synawood/creative/billing/load-hosted-spend-context'
import { validateMonthlyCapSetting } from '@synawood/creative/billing/monthly-cap'
import {
  getStudioClients,
  handleRouteError,
  jsonError,
  requireStudioAccess,
} from '@/lib/studio-server'

export const dynamic = 'force-dynamic'

/** Owner sets org monthly generator cap (#1042). Cap cannot exceed wallet + spent. */
export const PATCH = async (request: Request): Promise<Response> => {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError('Send JSON with productId and monthlyCapGbp.', 400)
    }

    const productId =
      body &&
      typeof body === 'object' &&
      'productId' in body &&
      typeof (body as { productId: unknown }).productId === 'string'
        ? (body as { productId: string }).productId.trim()
        : ''
    const rawCap =
      body &&
      typeof body === 'object' &&
      'monthlyCapGbp' in body &&
      typeof (body as { monthlyCapGbp: unknown }).monthlyCapGbp === 'number'
        ? (body as { monthlyCapGbp: number }).monthlyCapGbp
        : NaN

    if (!productId) {
      return jsonError('productId is required', 400)
    }
    if (!Number.isFinite(rawCap)) {
      return jsonError('monthlyCapGbp must be a number.', 400)
    }

    await requireStudioAccess({ productId, minRole: 'owner' })

    if (!isBillingEnabled()) {
      return jsonError('Hosted billing is off. Turn on BILLING_MODE to set a monthly cap.', 400)
    }

    const { supabase } = getStudioClients()
    const ctx = await loadHostedSpendContext(supabase, { productId })
    if (!ctx.hasWallet) {
      return jsonError('This organisation has no wallet yet. Finish organisation setup first.', 400)
    }

    const validation = validateMonthlyCapSetting({
      requestedCapGbp: rawCap,
      walletBalanceGbp: ctx.walletBalanceGbp,
      spentThisPeriodFromWalletGbp: ctx.spentThisMonthFromWalletGbp,
    })
    if (!validation.ok) {
      return jsonError(validation.error, 400)
    }

    const monthlyCapGbp = Number(rawCap.toFixed(4))
    const { data, error } = await supabase
      .from('product_billing')
      .update({
        monthly_generator_cap_gbp: monthlyCapGbp,
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', productId)
      .select('product_id')
      .maybeSingle()

    if (error) {
      return jsonError(`Could not save monthly cap: ${error.message}`, 500)
    }
    if (!data) {
      return jsonError(
        'No billing row for this organisation. Finish organisation setup first.',
        404,
      )
    }

    return Response.json({
      monthlyCapGbp,
      maxAllowedGbp: validation.maxAllowedGbp,
      walletBalanceGbp: ctx.walletBalanceGbp,
      spentThisPeriodFromWalletGbp: ctx.spentThisMonthFromWalletGbp,
    })
  } catch (err) {
    return handleRouteError(err, 'Failed to update monthly cap')
  }
}
