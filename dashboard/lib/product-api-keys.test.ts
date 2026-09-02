import { describe, expect, it, vi } from 'vitest'
import { formatApiKeyLastUsed, toPublicApiKey } from './api-console-copy'
import { generateApiKeyPlaintext, revokeProductApiKey } from './product-api-keys'
import { apiKeyPrefix, hashApiSecret } from './public-api-schema'

describe('product API keys (#1081)', () => {
  it('mints a mos_ secret that hashes and prefixes without storing plaintext', async () => {
    const plaintext = generateApiKeyPlaintext()
    expect(plaintext.startsWith('mos_')).toBe(true)
    expect(plaintext).toHaveLength(4 + 48)
    expect(apiKeyPrefix(plaintext)).toHaveLength(12)
    const hash = await hashApiSecret(plaintext)
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain(plaintext)
    expect(
      JSON.stringify(
        toPublicApiKey({
          id: 'k1',
          name: 'CI',
          key_prefix: apiKeyPrefix(plaintext),
          created_at: '2026-08-29T00:00:00.000Z',
          last_used_at: null,
          revoked_at: null,
        }),
      ),
    ).not.toContain(plaintext)
    expect(
      JSON.stringify(
        toPublicApiKey({
          id: 'k1',
          name: 'CI',
          key_prefix: apiKeyPrefix(plaintext),
          created_at: '2026-08-29T00:00:00.000Z',
          last_used_at: null,
          revoked_at: null,
        }),
      ),
    ).not.toContain(hash)
  })

  it('says Never when a key has not been used', () => {
    expect(formatApiKeyLastUsed(null)).toBe('Never')
    expect(
      formatApiKeyLastUsed('2026-08-29T10:00:00.000Z', new Date('2026-08-29T10:00:10.000Z')),
    ).toBe('Just now')
  })

  it('treats a second revoke as success when the row is already revoked', async () => {
    const revoked = {
      id: 'k1',
      name: 'CI',
      key_prefix: 'mos_abcdabcd',
      created_at: '2026-08-29T00:00:00.000Z',
      last_used_at: null,
      revoked_at: '2026-08-29T10:00:00.000Z',
    }
    const from = vi.fn((table: string) => {
      expect(table).toBe('product_api_keys')
      return {
        update: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: revoked, error: null }),
            }),
          }),
        }),
      }
    })
    const key = await revokeProductApiKey({
      supabase: { from } as never,
      productId: 'demo',
      keyId: 'k1',
    })
    expect(key.revokedAt).toBe(revoked.revoked_at)
  })
})
