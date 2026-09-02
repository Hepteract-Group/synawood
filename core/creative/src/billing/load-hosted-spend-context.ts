import type { SupabaseClient } from '@supabase/supabase-js'
import { sumCostEventsGbp } from '../pricing/ledger'

const sinceDaysAgoIso = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

const sumWalletDebitsGbp = async (
  supabase: SupabaseClient,
  input: { productId: string; sinceIso: string },
): Promise<number> => {
  const { data, error } = await supabase
    .from('wallet_ledger')
    .select('amount_gbp, kind')
    .eq('product_id', input.productId)
    .eq('kind', 'debit')
    .gte('created_at', input.sinceIso)
  if (error) {
    throw new Error(`Failed to sum wallet debits: ${error.message}`)
  }
  return (data ?? []).reduce((sum, row) => {
    const amount = Number(row.amount_gbp)
    return sum + (Number.isFinite(amount) ? Math.abs(amount) : 0)
  }, 0)
}

export type HostedSpendContext = {
  hasWallet: boolean
  walletBalanceGbp: number
  generationFrozen: boolean
  spentThisMonthGbp: number
  spentThisWeekGbp: number
  spentThisProjectGbp: number
  spentThisMonthFromWalletGbp: number
  /** Org settings cap when billing row exists; null when no row. */
  monthlyGeneratorCapGbp: number | null
  planId: string | null
  trialEndsAt: string | null
  seatLimit: number | null
  hasBillingRow: boolean
}

export const loadHostedSpendContext = async (
  supabase: SupabaseClient,
  input: { productId: string; projectId?: string | null },
): Promise<HostedSpendContext> => {
  const monthSince = sinceDaysAgoIso(31)
  const [
    walletRow,
    billingRow,
    spentThisMonthGbp,
    spentThisWeekGbp,
    spentThisProjectGbp,
    spentThisMonthFromWalletGbp,
  ] = await Promise.all([
    supabase
      .from('product_wallets')
      .select('balance_gbp')
      .eq('product_id', input.productId)
      .maybeSingle(),
    supabase
      .from('product_billing')
      .select('generation_frozen, monthly_generator_cap_gbp, plan_id, trial_ends_at, seat_limit')
      .eq('product_id', input.productId)
      .maybeSingle(),
    sumCostEventsGbp(supabase, { productId: input.productId, sinceIso: monthSince }),
    sumCostEventsGbp(supabase, { productId: input.productId, sinceIso: sinceDaysAgoIso(7) }),
    input.projectId
      ? sumCostEventsGbp(supabase, {
          productId: input.productId,
          projectId: input.projectId,
          sinceIso: sinceDaysAgoIso(365),
        })
      : Promise.resolve(0),
    sumWalletDebitsGbp(supabase, { productId: input.productId, sinceIso: monthSince }),
  ])

  if (walletRow.error) {
    throw new Error(`Failed to load product wallet: ${walletRow.error.message}`)
  }
  if (billingRow.error) {
    throw new Error(`Failed to load product billing: ${billingRow.error.message}`)
  }

  const balance = Number(walletRow.data?.balance_gbp ?? 0)
  const rawCap = billingRow.data?.monthly_generator_cap_gbp
  const capNum = rawCap == null ? null : Number(rawCap)
  const rawSeats = billingRow.data?.seat_limit
  const seatNum = rawSeats == null ? null : Number(rawSeats)
  return {
    hasWallet: walletRow.data != null,
    walletBalanceGbp: Number.isFinite(balance) ? balance : 0,
    generationFrozen: Boolean(billingRow.data?.generation_frozen),
    spentThisMonthGbp,
    spentThisWeekGbp,
    spentThisProjectGbp,
    spentThisMonthFromWalletGbp,
    monthlyGeneratorCapGbp: capNum != null && Number.isFinite(capNum) ? capNum : null,
    planId: typeof billingRow.data?.plan_id === 'string' ? billingRow.data.plan_id : null,
    trialEndsAt:
      typeof billingRow.data?.trial_ends_at === 'string' ? billingRow.data.trial_ends_at : null,
    seatLimit: seatNum != null && Number.isFinite(seatNum) ? seatNum : null,
    hasBillingRow: billingRow.data != null,
  }
}
