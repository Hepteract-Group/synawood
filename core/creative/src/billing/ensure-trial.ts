import type { SupabaseClient } from '@supabase/supabase-js'

const TRIAL_SEAT_LIMIT = 3
const TRIAL_DAYS = 14

/** 14-day trial window from `now` (ADR-0083 / #1034). */
export const trialEndsAt = (now: Date): string =>
  new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

type BillingClient = Pick<SupabaseClient, 'from'>

/** Idempotent: ignoreDuplicates so a second create does not reset a later plan. */
export const ensureTrialBilling = async (
  supabase: BillingClient,
  input: { productId: string; now?: Date },
): Promise<void> => {
  const now = input.now ?? new Date()
  const billing = await supabase.from('product_billing').upsert(
    {
      product_id: input.productId,
      plan_id: 'trial',
      status: 'trialing',
      seat_limit: TRIAL_SEAT_LIMIT,
      trial_ends_at: trialEndsAt(now),
      included_grant_gbp: 0,
      generation_frozen: false,
      updated_at: now.toISOString(),
    },
    { onConflict: 'product_id', ignoreDuplicates: true },
  )
  if (billing.error) {
    throw new Error(`Could not create trial billing: ${billing.error.message}`)
  }

  const wallet = await supabase.from('product_wallets').upsert(
    {
      product_id: input.productId,
      balance_gbp: 0,
      updated_at: now.toISOString(),
    },
    { onConflict: 'product_id', ignoreDuplicates: true },
  )
  if (wallet.error) {
    throw new Error(`Could not create trial wallet: ${wallet.error.message}`)
  }
}
