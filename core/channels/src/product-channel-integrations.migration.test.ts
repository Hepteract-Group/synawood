import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0057_product_channel_integrations.sql'),
  'utf8',
)

describe('product_channel_integrations migration (#797)', () => {
  it('stores product + organic channel → Postiz integration id with RLS', () => {
    expect(sql).toContain('create table public.product_channel_integrations')
    expect(sql).toContain('postiz_integration_id text not null')
    expect(sql).toContain('unique (product_id, channel)')
    expect(sql).toContain("channel in ('x_founder', 'linkedin_founder', 'tiktok_organic')")
    expect(sql).toMatch(
      /alter table public\.product_channel_integrations enable row level security/i,
    )
    expect(sql).toMatch(/is_product_member\(product_id, 'viewer'\)/)
    expect(sql).not.toMatch(/password|oauth_secret|social_token/i)
  })
})

const uniqueSql = readFileSync(
  path.join(
    process.cwd(),
    '../../supabase/migrations/0058_product_channel_integrations_unique_account.sql',
  ),
  'utf8',
)

describe('product_channel_integrations unique account (#798)', () => {
  it('forbids the same Postiz account on two Synawood channels', () => {
    expect(uniqueSql).toContain(
      'drop constraint if exists product_channel_integrations_product_integration_key',
    )
    expect(uniqueSql).toContain('partition by product_id, postiz_integration_id')
    const deleteAt = uniqueSql.indexOf('delete from public.product_channel_integrations')
    const uniqueAt = uniqueSql.indexOf('unique (product_id, postiz_integration_id)')
    expect(deleteAt).toBeGreaterThanOrEqual(0)
    expect(uniqueAt).toBeGreaterThan(deleteAt)
  })
})
