/** Billing instrumentation — ADR-0083 / #1061. Persists to audit_events as billing.* */

import type { SupabaseClient } from '@supabase/supabase-js'

export const BILLING_EVENTS = [
  'org_created',
  'brand_logo_set',
  'first_preview',
  'first_approve',
  'trial_ended',
  'wallet_debit',
  'wallet_blocked',
  'wallet_refund',
] as const

export type BillingEventName = (typeof BILLING_EVENTS)[number]

export const billingEventAction = (name: BillingEventName): string => `billing.${name}`

export type RecordBillingEventInput = {
  productId: string
  actorUserId?: string | null
  name: BillingEventName
  payload?: Record<string, unknown>
}

export const recordBillingEvent = async (
  supabase: SupabaseClient,
  input: RecordBillingEventInput,
): Promise<void> => {
  const { error } = await supabase.from('audit_events').insert({
    product_id: input.productId,
    actor_user_id: input.actorUserId ?? null,
    action: billingEventAction(input.name),
    payload: input.payload ?? {},
  })
  if (error) {
    throw new Error(`Failed to write billing event: ${error.message}`)
  }
}

export const hasBillingEvent = async (
  supabase: SupabaseClient,
  input: { productId: string; name: BillingEventName },
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('audit_events')
    .select('id')
    .eq('product_id', input.productId)
    .eq('action', billingEventAction(input.name))
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load billing event: ${error.message}`)
  }
  return Boolean(data)
}

/** Returns true when a new row was written. */
export const recordBillingEventOnce = async (
  supabase: SupabaseClient,
  input: RecordBillingEventInput,
): Promise<boolean> => {
  if (await hasBillingEvent(supabase, { productId: input.productId, name: input.name })) {
    return false
  }
  await recordBillingEvent(supabase, input)
  return true
}

/** Primary flows must succeed even when audit insert fails (#1061). */
export const recordBillingEventBestEffort = async (
  supabase: SupabaseClient,
  input: RecordBillingEventInput,
): Promise<void> => {
  try {
    await recordBillingEvent(supabase, input)
  } catch {
    // billing instrumentation is non-blocking
  }
}

export const recordBillingEventOnceBestEffort = async (
  supabase: SupabaseClient,
  input: RecordBillingEventInput,
): Promise<void> => {
  try {
    await recordBillingEventOnce(supabase, input)
  } catch {
    // billing instrumentation is non-blocking
  }
}
