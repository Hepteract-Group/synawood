/** Universal product audit log (ADR-0037 / #265). Service-role insert. */

import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditEventInput = {
  productId: string
  actorUserId?: string | null
  action: string
  payload?: Record<string, unknown>
}

export type AuditEvent = {
  id: string
  productId: string
  actorUserId: string | null
  action: string
  payload: Record<string, unknown>
  createdAt: string
}

export const logAuditEvent = async (
  supabase: SupabaseClient,
  input: AuditEventInput,
): Promise<void> => {
  const action = input.action.trim()
  if (!action) {
    throw new Error('Audit action is required.')
  }
  const { error } = await supabase.from('audit_events').insert({
    product_id: input.productId,
    actor_user_id: input.actorUserId ?? null,
    action,
    payload: input.payload ?? {},
  })
  if (error) {
    throw new Error(`Failed to write audit event: ${error.message}`)
  }
}

export const listAuditEvents = async (
  supabase: SupabaseClient,
  input: { productId: string; limit?: number },
): Promise<AuditEvent[]> => {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const { data, error } = await supabase
    .from('audit_events')
    .select('id, product_id, actor_user_id, action, payload, created_at')
    .eq('product_id', input.productId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to load audit events: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    productId: row.product_id as string,
    actorUserId: (row.actor_user_id as string | null) ?? null,
    action: row.action as string,
    payload:
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    createdAt: row.created_at as string,
  }))
}
