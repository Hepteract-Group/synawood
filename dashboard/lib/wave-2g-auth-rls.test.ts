import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasFeature, type FunctionalRole, type ProductFeature } from './functional-roles'
import { requireProductAuth } from './product-membership'

const rolesSql = readFileSync(
  path.join(process.cwd(), '../supabase/migrations/0045_functional_roles_audit.sql'),
  'utf8',
)
const founderSql = readFileSync(
  path.join(process.cwd(), '../supabase/migrations/0046_founder_functional_roles.sql'),
  'utf8',
)

const stubClient = (functionalRole: FunctionalRole, role = 'editor') => {
  const maybeSingle = async () => ({
    data: {
      user_id: 'u1',
      product_id: 'demo',
      role,
      functional_role: functionalRole,
    },
    error: null,
  })
  return {
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }),
  } as never
}

describe('audit_events RLS (#272 / ADR-0037)', () => {
  it('lets members SELECT and only service_role INSERT', () => {
    expect(rolesSql).toMatch(/alter table public\.audit_events enable row level security/i)
    expect(rolesSql).toContain("is_product_member(product_id, 'viewer')")
    expect(rolesSql).toMatch(/grant select on public\.audit_events to authenticated/i)
    expect(rolesSql).toMatch(/grant select, insert on public\.audit_events to service_role/i)
    expect(rolesSql).not.toMatch(/grant insert on public\.audit_events to authenticated/i)
    expect(rolesSql).not.toMatch(/for insert/i)
  })

  it('keeps functional_role required on members after founder backfill', () => {
    expect(founderSql).toContain("when 'owner' then 'founder'")
    expect(founderSql).toMatch(/alter column functional_role set not null/i)
  })
})

describe('job-function auth matrix (#272)', () => {
  const cases: Array<{
    role: FunctionalRole
    allow: ProductFeature[]
    deny: ProductFeature[]
  }> = [
    {
      role: 'editor',
      allow: ['studio.edit', 'studio.approve_submit'],
      deny: ['studio.publish', 'members.manage'],
    },
    {
      role: 'reviewer',
      allow: ['studio.review', 'insights.read'],
      deny: ['studio.edit', 'studio.publish'],
    },
    {
      role: 'publisher',
      allow: ['studio.publish', 'insights.read'],
      deny: ['studio.edit', 'studio.review'],
    },
    {
      role: 'analyst',
      allow: ['insights.read', 'outcomes.write'],
      deny: ['studio.edit', 'members.manage'],
    },
    {
      role: 'founder',
      allow: ['members.manage', 'studio.publish'],
      deny: [],
    },
  ]

  it('matches hasFeature to the ADR-0037 job map', () => {
    for (const row of cases) {
      for (const feature of row.allow) {
        expect(hasFeature(row.role, feature)).toBe(true)
      }
      for (const feature of row.deny) {
        expect(hasFeature(row.role, feature)).toBe(false)
      }
    }
  })

  it('requireProductAuth fails closed when the job cannot do the feature', async () => {
    await expect(
      requireProductAuth(stubClient('reviewer'), {
        userId: 'u1',
        productId: 'demo',
        feature: 'studio.edit',
      }),
    ).rejects.toMatchObject({ status: 403 })

    const publisher = await requireProductAuth(stubClient('publisher'), {
      userId: 'u1',
      productId: 'demo',
      feature: 'studio.publish',
    })
    expect(publisher.functionalRole).toBe('publisher')
  })
})
