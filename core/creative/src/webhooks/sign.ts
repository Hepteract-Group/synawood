import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const JOB_WEBHOOK_EVENTS = ['job.ready', 'job.failed'] as const

export type JobWebhookEvent = (typeof JOB_WEBHOOK_EVENTS)[number]

export type JobWebhookKind = 'generation' | 'render'

export type JobWebhookPayload = {
  event: JobWebhookEvent
  productId: string
  jobKind: JobWebhookKind
  jobId: string
  status: 'ready' | 'failed'
}

export const hashWebhookSecret = (secret: string): string => {
  const trimmed = secret.trim()
  if (!trimmed) {
    throw new Error('Webhook secret is required.')
  }
  return createHash('sha256').update(trimmed, 'utf8').digest('hex')
}

export const stringifyJobWebhookPayload = (payload: JobWebhookPayload): string =>
  JSON.stringify({
    event: payload.event,
    jobId: payload.jobId,
    jobKind: payload.jobKind,
    productId: payload.productId,
    status: payload.status,
  })

/** HMAC key is the stored SHA-256 hash. Plaintext webhook secrets are never persisted. */
export const signWebhookPayload = (secret: string, body: string): string =>
  `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`

const hashedEqual = (left: string, right: string): boolean => {
  const a = createHmac('sha256', 'mos-webhook-cmp').update(left).digest()
  const b = createHmac('sha256', 'mos-webhook-cmp').update(right).digest()
  return timingSafeEqual(a, b)
}

export const verifyWebhookPayload = (secret: string, body: string, signature: string): boolean =>
  hashedEqual(signWebhookPayload(secret, body), signature)
