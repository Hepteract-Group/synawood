import type { SupabaseClient } from '@supabase/supabase-js'
import type { JobWebhookPayload } from './sign'

export const WEBHOOK_MAX_ATTEMPTS = 5
export const WEBHOOK_RETRY_BASE_MS = 30_000

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed'

export type DueWebhookDelivery = {
  id: string
  webhook_id: string
  event: string
  payload: (JobWebhookPayload & { signature?: string }) | Record<string, unknown>
  status: WebhookDeliveryStatus
  attempt_count: number
  last_error: string | null
  next_attempt_at: string | null
  product_webhooks: { url: string; revoked_at: string | null } | null
}

export type WebhookHttpPost = (input: {
  url: string
  body: string
  headers: Record<string, string>
}) => Promise<{ status: number }>

export const webhookRetryDelayMs = (attemptCountAfterFailure: number): number =>
  WEBHOOK_RETRY_BASE_MS * 2 ** Math.max(0, attemptCountAfterFailure - 1)

export const isDeliveryDue = (
  row: Pick<DueWebhookDelivery, 'status' | 'next_attempt_at'>,
  now: Date,
): boolean => {
  if (row.status !== 'pending') return false
  if (!row.next_attempt_at) return true
  return new Date(row.next_attempt_at).getTime() <= now.getTime()
}

export const applyDeliveryAttempt = (input: {
  attemptCount: number
  ok: boolean
  error: string | null
  now: Date
}): {
  status: WebhookDeliveryStatus
  attempt_count: number
  last_error: string | null
  next_attempt_at: string | null
} => {
  if (input.ok) {
    return {
      status: 'delivered',
      attempt_count: input.attemptCount + 1,
      last_error: null,
      next_attempt_at: null,
    }
  }
  const attempt_count = input.attemptCount + 1
  if (attempt_count >= WEBHOOK_MAX_ATTEMPTS) {
    return {
      status: 'failed',
      attempt_count,
      last_error: input.error,
      next_attempt_at: null,
    }
  }
  return {
    status: 'pending',
    attempt_count,
    last_error: input.error,
    next_attempt_at: new Date(
      input.now.getTime() + webhookRetryDelayMs(attempt_count),
    ).toISOString(),
  }
}

export const postWebhookDelivery = async (input: {
  url: string
  body: string
  headers: Record<string, string>
}): Promise<{ status: number }> => {
  const response = await fetch(input.url, {
    method: 'POST',
    headers: input.headers,
    body: input.body,
  })
  return { status: response.status }
}

const signatureFromPayload = (payload: DueWebhookDelivery['payload']): string => {
  if (payload && typeof payload === 'object' && 'signature' in payload) {
    const signature = (payload as { signature?: unknown }).signature
    if (typeof signature === 'string') return signature
  }
  return ''
}

const nestedWebhook = (value: unknown): DueWebhookDelivery['product_webhooks'] => {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0]
    if (first && typeof first === 'object' && 'url' in first) {
      return first as NonNullable<DueWebhookDelivery['product_webhooks']>
    }
    return null
  }
  if (typeof value === 'object' && 'url' in value) {
    return value as NonNullable<DueWebhookDelivery['product_webhooks']>
  }
  return null
}

export const listDueWebhookDeliveries = async (
  supabase: SupabaseClient,
): Promise<DueWebhookDelivery[]> => {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select(
      'id, webhook_id, event, payload, status, attempt_count, last_error, next_attempt_at, product_webhooks ( url, revoked_at )',
    )
    .eq('status', 'pending')
  if (error) {
    throw new Error(`Failed to list webhook deliveries: ${error.message}`)
  }
  return ((data ?? []) as unknown as Array<DueWebhookDelivery>).map((row) => ({
    ...row,
    product_webhooks: nestedWebhook(row.product_webhooks),
  }))
}

const markDelivery = async (
  supabase: SupabaseClient,
  id: string,
  patch: ReturnType<typeof applyDeliveryAttempt>,
): Promise<void> => {
  const { error } = await supabase
    .from('webhook_deliveries')
    .update({
      status: patch.status,
      attempt_count: patch.attempt_count,
      last_error: patch.last_error,
      next_attempt_at: patch.next_attempt_at,
    })
    .eq('id', id)
  if (error) {
    throw new Error(`Failed to update webhook delivery: ${error.message}`)
  }
}

export const deliverDueWebhookDeliveries = async (input: {
  supabase: SupabaseClient
  post?: WebhookHttpPost
  now?: Date
}): Promise<{ delivered: number; retried: number; failed: number }> => {
  const now = input.now ?? new Date()
  const post = input.post ?? postWebhookDelivery
  const due = (await listDueWebhookDeliveries(input.supabase)).filter((row) =>
    isDeliveryDue(row, now),
  )
  let delivered = 0
  let retried = 0
  let failed = 0

  for (const row of due) {
    const url = row.product_webhooks?.url
    const revoked = row.product_webhooks?.revoked_at
    if (!url || revoked) {
      await markDelivery(
        input.supabase,
        row.id,
        applyDeliveryAttempt({
          attemptCount: WEBHOOK_MAX_ATTEMPTS - 1,
          ok: false,
          error: revoked ? 'Webhook was revoked.' : 'Webhook URL is missing.',
          now,
        }),
      )
      failed += 1
      continue
    }

    const body = JSON.stringify(row.payload)
    const headers = {
      'content-type': 'application/json',
      'x-mos-signature': signatureFromPayload(row.payload),
    }
    let ok = false
    let error: string | null = null
    try {
      const response = await post({ url, body, headers })
      ok = response.status >= 200 && response.status < 300
      if (!ok) error = `HTTP ${response.status}`
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Webhook POST failed.'
    }

    const patch = applyDeliveryAttempt({
      attemptCount: row.attempt_count,
      ok,
      error,
      now,
    })
    await markDelivery(input.supabase, row.id, patch)
    if (patch.status === 'delivered') delivered += 1
    else if (patch.status === 'failed') failed += 1
    else retried += 1
  }

  return { delivered, retried, failed }
}
