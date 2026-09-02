import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  HOSTED_WEBHOOK_LOCALHOST_COPY,
  isLoopbackWebhookHost,
  type PublicWebhook,
} from './api-console-copy'
import { hashApiSecret, WEBHOOK_EVENTS, type WebhookEvent } from './public-api-schema'

export const generateWebhookPlaintext = (): string => `whsec_${randomBytes(24).toString('hex')}`

export const assertWebhookUrl = (raw: string, hosted: boolean): URL => {
  const trimmed = raw.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Enter a valid http(s) webhook URL.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Webhook URL must be http or https.')
  }
  if (hosted && isLoopbackWebhookHost(trimmed)) {
    throw new Error(HOSTED_WEBHOOK_LOCALHOST_COPY)
  }
  return parsed
}

const parseEvents = (value: unknown): WebhookEvent[] => {
  const list = Array.isArray(value) ? value : WEBHOOK_EVENTS
  const allowed = list.filter(
    (event): event is WebhookEvent =>
      typeof event === 'string' && (WEBHOOK_EVENTS as readonly string[]).includes(event),
  )
  return allowed.length > 0 ? allowed : [...WEBHOOK_EVENTS]
}

const toPublicWebhook = (
  row: {
    id: string
    url: string
    events: string[] | null
    created_at: string
    revoked_at: string | null
  },
  delivery: { status: PublicWebhook['lastDeliveryStatus']; last_error: string | null } | null,
): PublicWebhook => ({
  id: row.id,
  url: row.url,
  events: row.events ?? [...WEBHOOK_EVENTS],
  createdAt: row.created_at,
  revokedAt: row.revoked_at,
  lastDeliveryStatus:
    delivery?.status === 'pending' ||
    delivery?.status === 'delivered' ||
    delivery?.status === 'failed'
      ? delivery.status
      : null,
  lastDeliveryError: delivery?.last_error ?? null,
})

export const listProductWebhooks = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<PublicWebhook[]> => {
  const { data, error } = await supabase
    .from('product_webhooks')
    .select('id, url, events, created_at, revoked_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`Failed to list webhooks: ${error.message}`)
  }
  const rows = (data ?? []) as Array<{
    id: string
    url: string
    events: string[] | null
    created_at: string
    revoked_at: string | null
  }>
  const ids = rows.map((row) => row.id)
  const latest = new Map<
    string,
    { status: PublicWebhook['lastDeliveryStatus']; last_error: string | null }
  >()
  if (ids.length > 0) {
    const { data: deliveries, error: deliveryError } = await supabase
      .from('webhook_deliveries')
      .select('webhook_id, status, last_error, created_at')
      .in('webhook_id', ids)
      .order('created_at', { ascending: false })
    if (deliveryError) {
      throw new Error(`Failed to list webhook deliveries: ${deliveryError.message}`)
    }
    for (const row of deliveries ?? []) {
      const id = (row as { webhook_id: string }).webhook_id
      if (latest.has(id)) continue
      latest.set(id, {
        status: (row as { status: PublicWebhook['lastDeliveryStatus'] }).status,
        last_error: (row as { last_error: string | null }).last_error,
      })
    }
  }
  return rows.map((row) => toPublicWebhook(row, latest.get(row.id) ?? null))
}

export const createProductWebhook = async (input: {
  supabase: SupabaseClient
  productId: string
  url: string
  events?: unknown
  hosted: boolean
}): Promise<{ webhook: PublicWebhook; plaintext: string }> => {
  const url = assertWebhookUrl(input.url, input.hosted).toString()
  const events = parseEvents(input.events)
  const plaintext = generateWebhookPlaintext()
  const secretHash = await hashApiSecret(plaintext)
  const { data, error } = await input.supabase
    .from('product_webhooks')
    .insert({
      product_id: input.productId,
      url,
      secret_hash: secretHash,
      events,
    })
    .select('id, url, events, created_at, revoked_at')
    .single()
  if (error) {
    throw new Error(`Failed to create webhook: ${error.message}`)
  }
  return {
    webhook: toPublicWebhook(data as Parameters<typeof toPublicWebhook>[0], null),
    plaintext,
  }
}

export const revokeProductWebhook = async (input: {
  supabase: SupabaseClient
  productId: string
  webhookId: string
}): Promise<PublicWebhook> => {
  const { data, error } = await input.supabase
    .from('product_webhooks')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', input.webhookId)
    .eq('product_id', input.productId)
    .is('revoked_at', null)
    .select('id, url, events, created_at, revoked_at')
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to revoke webhook: ${error.message}`)
  }
  if (data) {
    return toPublicWebhook(data as Parameters<typeof toPublicWebhook>[0], null)
  }
  const existing = await input.supabase
    .from('product_webhooks')
    .select('id, url, events, created_at, revoked_at')
    .eq('id', input.webhookId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (existing.error) {
    throw new Error(`Failed to revoke webhook: ${existing.error.message}`)
  }
  if (!existing.data) {
    throw new Error('Webhook not found.')
  }
  return toPublicWebhook(existing.data as Parameters<typeof toPublicWebhook>[0], null)
}
