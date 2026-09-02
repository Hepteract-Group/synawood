import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { decryptSecret, encryptSecret } from './encrypt'
import { matchOutcome } from './match'
import { pullCommerce } from './commerce'
import { pullOrganic } from './organic'
import { pullOneProvider } from './pull-worker'
import { buildAuthorizeUrl, oauthIsConfigured, parseOAuthState, signOAuthState } from './oauth'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0033_performance_ingestion.sql'),
  'utf8',
)

const pullSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0042_performance_pull_oauth.sql'),
  'utf8',
)

const KEY = 'a'.repeat(64)

describe('performance ingestion (#238–#244)', () => {
  it('defines outcomes, secrets, and creative_performance', () => {
    expect(migrationSql).toContain('create table public.outcomes')
    expect(migrationSql).toContain('create table public.integration_secrets')
    expect(migrationSql).toContain('create materialized view public.creative_performance')
    expect(migrationSql).toContain('refresh_creative_performance')
  })

  it('round-trips encrypted tokens (#239)', () => {
    const sealed = encryptSecret('tok_live_test', KEY)
    expect(sealed.ciphertext).not.toContain('tok_live_test')
    expect(decryptSecret(sealed, KEY)).toBe('tok_live_test')
    expect(() => encryptSecret('x', 'short')).toThrow(/PERFORMANCE_TOKEN_KEY/)
  })

  it('organic pull stays stub (#240)', () => {
    expect(pullOrganic({ provider: 'tiktok', connected: false }).reason).toBe('not_connected')
    expect(pullOrganic({ provider: 'tiktok', connected: true })).toEqual({
      ok: true,
      rows: [],
      reason: 'stub_provider',
    })
  })

  it('commerce pull stays stub (#241)', () => {
    expect(pullCommerce({ provider: 'shopify', connected: true }).reason).toBe('stub_provider')
    expect(pullCommerce({ provider: 'stripe', connected: false }).reason).toBe('not_connected')
  })

  it('matches posted URL and otherwise leaves unattributed (#243)', () => {
    const records = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        finalAssetId: '22222222-2222-4222-8222-222222222222',
        projectId: '33333333-3333-4333-8333-333333333333',
        externalUrl: 'https://x.com/p/1',
      },
    ]
    expect(matchOutcome({ externalUrl: 'https://x.com/p/1', records })).toMatchObject({
      finalAssetId: records[0]!.finalAssetId,
    })
    expect(matchOutcome({ externalUrl: 'https://x.com/other', records })).toEqual({
      unattributed: true,
      reason: 'no_match',
    })
    expect(
      matchOutcome({
        finalAssetId: '99999999-9999-4999-8999-999999999999',
        records,
      }),
    ).toEqual({ unattributed: true, reason: 'no_match' })
    expect(
      matchOutcome({
        finalAssetId: records[0]!.finalAssetId,
        records,
      }),
    ).toMatchObject({
      publishRecordId: records[0]!.id,
      finalAssetId: records[0]!.finalAssetId,
    })
  })

  it('pins search_path on the refresh RPC', () => {
    expect(migrationSql).toContain('set search_path = public')
  })

  it('defines beat_count from structure JSON and a unique Final index (#249)', () => {
    expect(migrationSql).toContain('jsonb_array_length')
    expect(migrationSql).toContain('as beat_count')
    expect(migrationSql).toContain('create unique index creative_performance_final_idx')
  })
})

describe('performance pull + oauth (#245–#246)', () => {
  it('adds last_pull columns', () => {
    expect(pullSql).toContain('last_pull_at')
    expect(pullSql).toContain("auth_kind text not null default 'token'")
  })

  it('worker pull stays stub', () => {
    expect(pullOneProvider({ provider: 'tiktok', connected: false }).reason).toBe('not_connected')
    expect(pullOneProvider({ provider: 'shopify', connected: true }).reason).toBe('stub_provider')
  })

  it('oauth is locked without app ids', () => {
    expect(oauthIsConfigured('tiktok', {})).toBe(false)
    expect(() =>
      buildAuthorizeUrl({
        productId: 'demo',
        provider: 'tiktok',
        state: 'x',
        env: {},
      }),
    ).toThrow(/TIKTOK_CLIENT_ID/)
  })

  it('signs and verifies oauth state', () => {
    const state = signOAuthState({
      productId: 'demo',
      provider: 'tiktok',
      keyHex: KEY,
      nowMs: 1_000,
    })
    expect(
      parseOAuthState({
        state,
        productId: 'demo',
        provider: 'tiktok',
        keyHex: KEY,
        nowMs: 1_000,
      }),
    ).toEqual({ shop: '' })
    expect(() =>
      parseOAuthState({
        state,
        productId: 'other',
        provider: 'tiktok',
        keyHex: KEY,
        nowMs: 1_000,
      }),
    ).toThrow(/does not match/)
  })

  it('oauth authorize url includes callback when configured', () => {
    const url = buildAuthorizeUrl({
      productId: 'demo',
      provider: 'tiktok',
      state: 'abc',
      env: {
        TIKTOK_CLIENT_ID: 'cid',
        TIKTOK_CLIENT_SECRET: 'secret',
        DASHBOARD_PUBLIC_URL: 'http://127.0.0.1:3011',
      },
    })
    expect(url).toContain('tiktok.com')
    expect(url).toContain('client_key=cid')
    expect(url).toContain('integrations%2Foauth%2Ftiktok%2Fcallback')
  })
})
