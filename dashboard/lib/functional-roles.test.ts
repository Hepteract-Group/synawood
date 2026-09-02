import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(process.cwd(), '../supabase/migrations/0045_functional_roles_audit.sql'),
  'utf8',
)

describe('functional roles schema (#263 / ADR-0037)', () => {
  it('adds functional_role and audit_events without replacing tenancy role', () => {
    expect(sql).toContain('functional_role')
    expect(sql).toContain('founder')
    expect(sql).toContain('create table if not exists public.audit_events')
    expect(sql).toContain("is_product_member(product_id, 'viewer')")
    expect(sql).not.toMatch(/drop table public.product_members/i)
  })
})

describe('role copy (#268)', () => {
  it('labels every job function and feature', async () => {
    const { FUNCTIONAL_ROLES, FUNCTIONAL_ROLE_LABEL, PRODUCT_FEATURES, PRODUCT_FEATURE_LABEL } =
      await import('./functional-roles')
    for (const role of FUNCTIONAL_ROLES) {
      expect(FUNCTIONAL_ROLE_LABEL[role].length).toBeGreaterThan(0)
    }
    for (const feature of PRODUCT_FEATURES) {
      expect(PRODUCT_FEATURE_LABEL[feature].length).toBeGreaterThan(0)
    }
  })
})
