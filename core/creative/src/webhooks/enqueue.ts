import type { SupabaseClient } from '@supabase/supabase-js'
import {
  JOB_WEBHOOK_EVENTS,
  signWebhookPayload,
  stringifyJobWebhookPayload,
  type JobWebhookEvent,
  type JobWebhookKind,
  type JobWebhookPayload,
} from './sign'

export type ProductWebhookRow = {
  id: string
  events: string[] | null
  revoked_at: string | null
  secret_hash: string
}

export type WebhookDeliveryRow = {
  webhook_id: string
  event: JobWebhookEvent
  payload: JobWebhookPayload & { signature: string }
  status: 'pending'
  attempt_count: number
}

const isJobWebhookEvent = (value: string): value is JobWebhookEvent =>
  (JOB_WEBHOOK_EVENTS as readonly string[]).includes(value)

const statusForEvent = (event: JobWebhookEvent): JobWebhookPayload['status'] =>
  event === 'job.ready' ? 'ready' : 'failed'

const webhookSubscribes = (row: ProductWebhookRow, event: JobWebhookEvent): boolean => {
  if (row.revoked_at) return false
  const events = row.events ?? []
  return events.includes(event)
}

export const loadActiveProductWebhooks = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<ProductWebhookRow[]> => {
  const { data, error } = await supabase
    .from('product_webhooks')
    .select('id, events, revoked_at, secret_hash')
    .eq('product_id', productId)
    .is('revoked_at', null)
  if (error) {
    throw new Error(`Failed to load product webhooks: ${error.message}`)
  }
  return (data ?? []) as ProductWebhookRow[]
}

export const enqueueJobWebhookDeliveries = async (input: {
  supabase: SupabaseClient
  productId: string
  jobId: string
  jobKind: JobWebhookKind
  event: JobWebhookEvent
}): Promise<WebhookDeliveryRow[]> => {
  if (!isJobWebhookEvent(input.event)) return []
  const webhooks = (await loadActiveProductWebhooks(input.supabase, input.productId)).filter(
    (row) => webhookSubscribes(row, input.event),
  )
  if (webhooks.length === 0) return []

  const payload: JobWebhookPayload = {
    event: input.event,
    productId: input.productId,
    jobKind: input.jobKind,
    jobId: input.jobId,
    status: statusForEvent(input.event),
  }
  const body = stringifyJobWebhookPayload(payload)
  const rows: WebhookDeliveryRow[] = []

  for (const webhook of webhooks) {
    const row: WebhookDeliveryRow = {
      webhook_id: webhook.id,
      event: input.event,
      payload: {
        ...payload,
        signature: signWebhookPayload(webhook.secret_hash, body),
      },
      status: 'pending',
      attempt_count: 0,
    }
    const { error } = await input.supabase.from('webhook_deliveries').insert(row)
    if (error) {
      throw new Error(`Failed to enqueue webhook delivery: ${error.message}`)
    }
    rows.push(row)
  }
  return rows
}

export const enqueueJobWebhooksAfterMark = async (input: {
  supabase: SupabaseClient
  productId: string
  jobId: string
  jobKind: JobWebhookKind
  event: JobWebhookEvent | null
}): Promise<void> => {
  if (!input.event) return
  const event = input.event
  try {
    await enqueueJobWebhookDeliveries({ ...input, event })
  } catch (error) {
    console.error('Webhook enqueue failed; job mark kept', {
      jobId: input.jobId,
      event: input.event,
      error,
    })
  }
}

export const generationWebhookEvent = (status: string | undefined): JobWebhookEvent | null => {
  if (status === 'ready') return 'job.ready'
  if (status === 'failed') return 'job.failed'
  return null
}

export const renderWebhookEvent = (status: string | undefined): JobWebhookEvent | null => {
  if (status === 'completed' || status === 'ready') return 'job.ready'
  if (status === 'failed') return 'job.failed'
  return null
}
