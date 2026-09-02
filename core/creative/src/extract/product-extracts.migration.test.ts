import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0060_product_extracts.sql'),
  'utf8',
)

describe('product_extracts migration (#1089)', () => {
  it('creates product-scoped extracts with quality enum and member RLS', () => {
    expect(sql).toContain('create table public.product_extracts')
    expect(sql).toContain('product_id text not null')
    expect(sql).toMatch(/kind in \('screenshot', 'still', 'text'\)/)
    expect(sql).toContain('source_url text not null')
    expect(sql).toContain('blob_key text')
    expect(sql).toMatch(/quality in \('usable', 'weak', 'reject'\)/)
    expect(sql).toContain('job_id uuid references public.generation_jobs')
    expect(sql).toMatch(/alter table public\.product_extracts enable row level security/i)
    expect(sql).toMatch(/is_product_member\(product_id, 'viewer'\)/)
    expect(sql).toMatch(/is_product_member\(product_id, 'editor'\)/)
    expect(sql).toMatch(
      /grant select, insert, update, delete on public\.product_extracts to authenticated/,
    )
  })

  it('scopes reads and writes by product membership so cross-product access fails at RLS', () => {
    expect(sql).toMatch(
      /create policy product_extracts_select[\s\S]*using \(public\.is_product_member\(product_id, 'viewer'\)\)/,
    )
    expect(sql).toMatch(
      /create policy product_extracts_write[\s\S]*using \(public\.is_product_member\(product_id, 'editor'\)\)/,
    )
    expect(sql).toMatch(
      /create policy product_extracts_write[\s\S]*with check \(public\.is_product_member\(product_id, 'editor'\)\)/,
    )
  })
})
