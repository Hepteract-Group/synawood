import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { apiKeyPrefix, hashApiSecret, WEBHOOK_EVENTS } from './public-api-schema'

const sql = readFileSync(
  path.join(process.cwd(), '../supabase/migrations/0047_public_api_v1.sql'),
  'utf8',
)

describe('public API schema (#274 / ADR-0038)', () => {
  it('stores hashed keys, idempotency, and webhooks without plaintext', () => {
    expect(sql).toContain('create table if not exists public.product_api_keys')
    expect(sql).toContain('key_hash text not null unique')
    expect(sql).toContain('create table if not exists public.api_idempotency')
    expect(sql).toContain('unique (product_id, idempotency_key)')
    expect(sql).toContain('create table if not exists public.product_webhooks')
    expect(sql).toContain('create table if not exists public.webhook_deliveries')
    expect(sql).not.toMatch(/plaintext|secret_raw|api_key text not null/)
    expect(sql).toMatch(/alter table public\.product_api_keys enable row level security/i)
    expect(sql).toMatch(/is_product_member\(product_id, 'owner'\)/)
    expect(sql).not.toMatch(/grant insert on public\.product_api_keys to authenticated/i)
  })

  it('hashes secrets with SHA-256 and keeps a short prefix', async () => {
    const secret = 'mos_live_test_secret_value'
    const hash = await hashApiSecret(secret)
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain(secret)
    expect(apiKeyPrefix(secret)).toBe('mos_live_tes')
    expect(WEBHOOK_EVENTS).toEqual(['job.ready', 'job.failed'])
  })
})
