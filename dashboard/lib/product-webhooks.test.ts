import { describe, expect, it } from 'vitest'
import { HOSTED_WEBHOOK_LOCALHOST_COPY, isLoopbackWebhookHost } from './api-console-copy'
import { assertWebhookUrl, generateWebhookPlaintext } from './product-webhooks'
import { hashApiSecret } from './public-api-schema'

describe('product webhooks (#1082)', () => {
  it('mints a hashed signing secret without putting plaintext on the public row', async () => {
    const plaintext = generateWebhookPlaintext()
    expect(plaintext.startsWith('whsec_')).toBe(true)
    const hash = await hashApiSecret(plaintext)
    expect(hash).not.toContain(plaintext)
  })

  it('refuses hosted localhost URLs with a full sentence', () => {
    expect(isLoopbackWebhookHost('http://localhost:4000/hook')).toBe(true)
    expect(() => assertWebhookUrl('http://localhost:4000/hook', true)).toThrow(
      HOSTED_WEBHOOK_LOCALHOST_COPY,
    )
    expect(() => assertWebhookUrl('https://example.test/hooks', true)).not.toThrow()
    expect(() => assertWebhookUrl('http://127.0.0.1:4000/hook', false)).not.toThrow()
  })
})
