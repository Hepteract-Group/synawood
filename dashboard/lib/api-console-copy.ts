import { PRODUCT_NAME } from './product-name'

export const API_KEY_OWNER_ONLY_COPY = 'Only owners can create API keys.'
export const API_KEY_EMPTY_COPY = 'No API keys yet.'
export const API_KEY_SECRET_ONCE_COPY = 'You will not see this again.'
export const API_KEY_INTRO =
  'Call first-party Studio Tools over HTTP with a Product key. Spend still uses the confirm-spend gate.'
export const WEBHOOK_EMPTY_COPY = 'No webhooks yet.'
export const HOSTED_WEBHOOK_LOCALHOST_COPY = `Hosted ${PRODUCT_NAME} cannot reach localhost. Use a public https:// URL or self-host.`
export const WEBHOOK_CONSENT_COPY = `Job payloads will leave ${PRODUCT_NAME} for this URL.`

export const webhookFailedDeliveryCopy = (error: string): string => {
  const trimmed = error.trim()
  if (!trimmed) return 'failed'
  return `failed — ${trimmed}`
}

export type PublicWebhook = {
  id: string
  url: string
  events: string[]
  createdAt: string
  revokedAt: string | null
  lastDeliveryStatus: 'pending' | 'delivered' | 'failed' | null
  lastDeliveryError: string | null
}

export const isLoopbackWebhookHost = (raw: string): boolean => {
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.localhost')
    )
  } catch {
    return false
  }
}

export type PublicApiKey = {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export const formatApiKeyLastUsed = (iso: string | null, now = new Date()): string => {
  if (!iso) return 'Never'
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 'Never'
  const deltaMs = now.getTime() - then.getTime()
  if (deltaMs < 60_000) return 'Just now'
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export const toPublicApiKey = (row: {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}): PublicApiKey => ({
  id: row.id,
  name: row.name,
  keyPrefix: row.key_prefix,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
  revokedAt: row.revoked_at,
})
