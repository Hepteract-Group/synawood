import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { API_RATE_LIMIT_PER_MINUTE, readBearerToken, utcMinuteWindowStart } from './with-api-key'

vi.mock('./studio-server', () => ({
  getStudioClients: () => ({ supabase: {} }),
}))

const sql = readFileSync(
  path.join(process.cwd(), '../supabase/migrations/0048_api_rate_buckets.sql'),
  'utf8',
)

describe('api rate buckets (#275)', () => {
  it('bumps hit_count in a UTC minute window for service_role only', () => {
    expect(sql).toContain('create table if not exists public.api_rate_buckets')
    expect(sql).toContain('bump_api_rate')
    expect(sql).toMatch(/grant execute on function public\.bump_api_rate/i)
    expect(sql).not.toMatch(/grant execute[\s\S]*bump_api_rate[\s\S]*authenticated/i)
  })
})

describe('withApiKey helpers', () => {
  it('reads a Bearer token and rejects a missing header', () => {
    expect(
      readBearerToken(new Request('http://x', { headers: { authorization: 'Bearer mos_abc' } })),
    ).toBe('mos_abc')
    expect(readBearerToken(new Request('http://x'))).toBeNull()
  })

  it('truncates to the UTC minute and keeps the default cap at 60', () => {
    expect(utcMinuteWindowStart(Date.parse('2026-08-22T09:07:41.500Z'))).toBe(
      '2026-08-22T09:07:00.000Z',
    )
    expect(API_RATE_LIMIT_PER_MINUTE).toBe(60)
  })
})
