import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isBillingEnabled } from './billing-mode'
import { recordBillingEventBestEffort } from './events'
import { debitIdempotencyKey } from './debit-for-job'

/** Mirrors the debit idempotency shape: `refund:{debitLedgerId}`. */
export const refundIdempotencyKey = (debitLedgerId: string): string => `refund:${debitLedgerId}`

/**
 * Pure predicate: true when a job outcome warrants a wallet refund.
 *
 * Vendor actual > 0 means the model provider was billed for the attempt;
 * in that case the credit is kept, but usage still shows the job row.
 */
export const shouldRefundOnJobFail = (input: {
  status: string
  actualGbp: number | null
}): boolean => {
  const isTerminal = input.status === 'failed' || input.status === 'cancelled'
  const hasVendorCharge = input.actualGbp != null && input.actualGbp > 0
  return isTerminal && !hasVendorCharge
}

export type RefundJobWalletResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; ledgerId: string; balanceGbp: number }

/**
 * Attempt to refund the wallet debit that was taken when this job started.
 *
 * Idempotent: a second call returns the existing refund ledger row unchanged.
 * Safe to call even when billing was not active for the job (skips gracefully).
 */
export const refundJobWallet = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    jobId: string
    status: string
    actualGbp: number | null
  },
): Promise<RefundJobWalletResult> => {
  if (!shouldRefundOnJobFail({ status: input.status, actualGbp: input.actualGbp })) {
    return { ok: true, skipped: true, reason: 'no_refund_needed' }
  }
  if (!isBillingEnabled()) {
    return { ok: true, skipped: true, reason: 'billing_off' }
  }

  // Resolve the debit for this job via its idempotency key.
  const { data: debit, error: debitError } = await supabase
    .from('wallet_ledger')
    .select('id, amount_gbp, cost_event_id, job_id')
    .eq('idempotency_key', debitIdempotencyKey(input.jobId))
    .maybeSingle()
  if (debitError) {
    throw new Error(`Failed to load debit ledger entry: ${debitError.message}`)
  }
  if (!debit) {
    return { ok: true, skipped: true, reason: 'no_debit_found' }
  }

  const debitLedgerId = debit.id as string
  const idempotencyKey = refundIdempotencyKey(debitLedgerId)

  // Idempotency: if a refund entry already exists, return it.
  const { data: existing, error: existingError } = await supabase
    .from('wallet_ledger')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existingError) {
    throw new Error(`Failed to check refund idempotency: ${existingError.message}`)
  }
  if (existing) {
    const { data: walletRow } = await supabase
      .from('product_wallets')
      .select('balance_gbp')
      .eq('product_id', input.productId)
      .maybeSingle()
    return {
      ok: true,
      skipped: false,
      ledgerId: existing.id as string,
      balanceGbp: Number(walletRow?.balance_gbp ?? 0),
    }
  }

  // Load current wallet balance.
  const { data: walletRow, error: walletError } = await supabase
    .from('product_wallets')
    .select('balance_gbp')
    .eq('product_id', input.productId)
    .maybeSingle()
  if (walletError) {
    throw new Error(`Failed to load product wallet: ${walletError.message}`)
  }
  if (!walletRow) {
    return { ok: true, skipped: true, reason: 'no_wallet' }
  }

  const currentBalance = Number(walletRow.balance_gbp)
  const startingBalance = Number.isFinite(currentBalance) ? currentBalance : 0
  const refundAmountGbp = Math.abs(Number(debit.amount_gbp))
  const newBalance = startingBalance + refundAmountGbp
  const ledgerId = randomUUID()

  const { error: insertError } = await supabase.from('wallet_ledger').insert({
    id: ledgerId,
    product_id: input.productId,
    amount_gbp: refundAmountGbp,
    kind: 'refund',
    cost_event_id: debit.cost_event_id,
    job_id: debit.job_id,
    idempotency_key: idempotencyKey,
  })
  if (insertError) {
    throw new Error(`Failed to write wallet refund: ${insertError.message}`)
  }

  const { error: walletUpdateError } = await supabase
    .from('product_wallets')
    .update({ balance_gbp: newBalance, updated_at: new Date().toISOString() })
    .eq('product_id', input.productId)
  if (walletUpdateError) {
    throw new Error(`Failed to credit wallet balance: ${walletUpdateError.message}`)
  }

  await recordBillingEventBestEffort(supabase, {
    productId: input.productId,
    name: 'wallet_refund',
    payload: {
      jobId: input.jobId,
      debitLedgerId,
      refundGbp: refundAmountGbp,
      balanceGbp: newBalance,
      ledgerId,
    },
  })

  return { ok: true, skipped: false, ledgerId, balanceGbp: newBalance }
}
