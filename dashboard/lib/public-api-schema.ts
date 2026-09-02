/** Hash helpers for Product API keys (ADR-0038 / #274). Plaintext never stored. */

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')

export const hashApiSecret = async (secret: string): Promise<string> => {
  const trimmed = secret.trim()
  if (!trimmed) {
    throw new Error('API secret is required.')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(trimmed))
  return toHex(digest)
}

/** Display prefix only — `mos_` plus the first 8 hex chars of the hash is not enough; use the raw token head. */
export const apiKeyPrefix = (plaintext: string): string => {
  const token = plaintext.trim()
  if (token.length < 12) {
    throw new Error('API key is too short to prefix.')
  }
  return token.slice(0, 12)
}

export const WEBHOOK_EVENTS = ['job.ready', 'job.failed'] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]
