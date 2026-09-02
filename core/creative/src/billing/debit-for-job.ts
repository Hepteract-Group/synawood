import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isBillingEnabled } from './billing-mode'
import { recordBillingEventBestEffort } from './events'
import { debitWallet, emptyWallet } from './wallet'
import { recordCostEvent } from '../pricing/ledger'

export const debitIdempotencyKey = (jobId: string): string => `debit:${jobId}`

export type DebitForJobInput = {
  productId: string
  projectId?: string | null
  jobId: string
  role: string
  modelId?: string
  units?: number
  estimatedGbp: number
  confirmSpend?: boolean
}

export type DebitForJobResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false; costEventId: string; balanceGbp: number }
  | { ok: false; code: 'wallet_insufficient'; error: string }

export const debitForJob = async (
  supabase: SupabaseClient,
  input: DebitForJobInput,
): Promise<DebitForJobResult> => {
  if (input.estimatedGbp <= 0) return { ok: true, skipped: true }
  if (!isBillingEnabled()) return { ok: true, skipped: true }
  if (!input.confirmSpend) return { ok: true, skipped: true }

  const idempotencyKey = debitIdempotencyKey(input.jobId)

  const { data: existing, error: existingError } = await supabase
    .from('wallet_ledger')
    .select('id, cost_event_id, amount_gbp, created_at')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existingError) {
    throw new Error(`Failed to load wallet debit idempotency: ${existingError.message}`)
  }
  if (existing?.cost_event_id) {
    const { data: walletRow } = await supabase
      .from('product_wallets')
      .select('balance_gbp, updated_at')
      .eq('product_id', input.productId)
      .maybeSingle()
    const balanceGbp = Number(walletRow?.balance_gbp ?? 0)
    const startingBalance = Number.isFinite(balanceGbp) ? balanceGbp : 0
    const ledgerAt = new Date(String(existing.created_at)).getTime()
    const walletAt = new Date(String(walletRow?.updated_at ?? 0)).getTime()
    if (walletAt < ledgerAt) {
      const dryDebit = debitWallet(emptyWallet(input.productId, startingBalance), {
        estimatedGbp: input.estimatedGbp,
        costEventId: existing.cost_event_id as string,
        idempotencyKey,
        ledgerId: existing.id as string,
        jobId: input.jobId,
      })
      if (dryDebit.ok) {
        const { error: walletUpdateError } = await supabase
          .from('product_wallets')
          .update({
            balance_gbp: dryDebit.state.balanceGbp,
            updated_at: new Date().toISOString(),
          })
          .eq('product_id', input.productId)
        if (walletUpdateError) {
          throw new Error(`Failed to update wallet balance: ${walletUpdateError.message}`)
        }
        return {
          ok: true,
          skipped: false,
          costEventId: existing.cost_event_id as string,
          balanceGbp: dryDebit.state.balanceGbp,
        }
      }
    }
    return {
      ok: true,
      skipped: false,
      costEventId: existing.cost_event_id as string,
      balanceGbp: startingBalance,
    }
  }

  const { data: existingCost, error: existingCostError } = await supabase
    .from('cost_events')
    .select('id')
    .eq('job_id', input.jobId)
    .maybeSingle()
  if (existingCostError) {
    throw new Error(`Failed to load cost event for job: ${existingCostError.message}`)
  }

  const { data: walletRow, error: walletError } = await supabase
    .from('product_wallets')
    .select('balance_gbp')
    .eq('product_id', input.productId)
    .maybeSingle()
  if (walletError) {
    throw new Error(`Failed to load product wallet: ${walletError.message}`)
  }
  if (!walletRow) return { ok: true, skipped: true }

  const balanceGbp = Number(walletRow.balance_gbp)
  const startingBalance = Number.isFinite(balanceGbp) ? balanceGbp : 0
  const ledgerId = randomUUID()
  const dryDebit = debitWallet(emptyWallet(input.productId, startingBalance), {
    estimatedGbp: input.estimatedGbp,
    costEventId: 'pending',
    idempotencyKey,
    ledgerId,
    jobId: input.jobId,
  })
  if (!dryDebit.ok) {
    await recordBillingEventBestEffort(supabase, {
      productId: input.productId,
      name: 'wallet_blocked',
      payload: {
        jobId: input.jobId,
        role: input.role,
        modelId: input.modelId,
        estimatedGbp: input.estimatedGbp,
        balanceGbp: startingBalance,
      },
    })
    return {
      ok: false,
      code: 'wallet_insufficient',
      error: `This job is about £${input.estimatedGbp.toFixed(2)}. Your organisation has £${startingBalance.toFixed(2)} left. Buy credits to run it.`,
    }
  }

  const { id: costEventId } = existingCost?.id
    ? { id: existingCost.id as string }
    : await recordCostEvent(supabase, {
        productId: input.productId,
        projectId: input.projectId ?? undefined,
        jobId: input.jobId,
        role: input.role,
        modelId: input.modelId,
        units: input.units,
        estimatedGbp: input.estimatedGbp,
      })

  const { error: ledgerInsertError } = await supabase.from('wallet_ledger').insert({
    id: ledgerId,
    product_id: input.productId,
    amount_gbp: -input.estimatedGbp,
    kind: 'debit',
    cost_event_id: costEventId,
    job_id: input.jobId,
    idempotency_key: idempotencyKey,
  })
  if (ledgerInsertError) {
    throw new Error(`Failed to write wallet debit: ${ledgerInsertError.message}`)
  }

  const { error: walletUpdateError } = await supabase
    .from('product_wallets')
    .update({
      balance_gbp: dryDebit.state.balanceGbp,
      updated_at: new Date().toISOString(),
    })
    .eq('product_id', input.productId)
  if (walletUpdateError) {
    throw new Error(`Failed to update wallet balance: ${walletUpdateError.message}`)
  }

  await recordBillingEventBestEffort(supabase, {
    productId: input.productId,
    name: 'wallet_debit',
    payload: {
      jobId: input.jobId,
      role: input.role,
      modelId: input.modelId,
      estimatedGbp: input.estimatedGbp,
      balanceGbp: dryDebit.state.balanceGbp,
      costEventId,
      ledgerId,
    },
  })

  return {
    ok: true,
    skipped: false,
    costEventId,
    balanceGbp: dryDebit.state.balanceGbp,
  }
}
