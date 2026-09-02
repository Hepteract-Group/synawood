import { describe, expect, it } from 'vitest'
import {
  hasMinProductRole,
  isProductRole,
  productRoleRank,
  requireProductAuth,
  requireProductRole,
  type ProductRole,
} from './product-membership'

describe('product membership roles', () => {
  it('ranks roles with fail-closed unknown', () => {
    expect(productRoleRank('viewer')).toBe(1)
    expect(productRoleRank('editor')).toBe(2)
    expect(productRoleRank('owner')).toBe(3)
    expect(productRoleRank(undefined)).toBe(0)
    expect(productRoleRank('admin')).toBe(0)
  })

  it('checks minimum role inclusively', () => {
    expect(hasMinProductRole('owner', 'viewer')).toBe(true)
    expect(hasMinProductRole('editor', 'editor')).toBe(true)
    expect(hasMinProductRole('viewer', 'editor')).toBe(false)
    expect(hasMinProductRole(null, 'viewer')).toBe(false)
  })

  it('narrows product roles', () => {
    expect(isProductRole('owner')).toBe(true)
    expect(isProductRole('admin')).toBe(false)
  })
})

describe('requireProductRole', () => {
  const stubClient = (
    row: { user_id: string; product_id: string; role: string; functional_role: string } | null,
  ) => {
    const maybeSingle = async () => ({ data: row, error: null })
    const eq2 = () => ({ maybeSingle })
    const eq1 = () => ({ eq: eq2 })
    const select = () => ({ eq: eq1 })
    return { from: () => ({ select }) } as never
  }

  it('returns membership when role meets minimum', async () => {
    const membership = await requireProductRole(
      stubClient({
        user_id: 'u1',
        product_id: 'demo',
        role: 'owner',
        functional_role: 'founder',
      }),
      { userId: 'u1', productId: 'demo', minRole: 'editor' },
    )
    expect(membership.role).toBe('owner' satisfies ProductRole)
    expect(membership.functionalRole).toBe('founder')
  })

  it('fails closed for non-members', async () => {
    await expect(
      requireProductRole(stubClient(null), {
        userId: 'u1',
        productId: 'demo',
        minRole: 'viewer',
      }),
    ).rejects.toMatchObject({ name: 'ProductAccessError', status: 403 })
  })

  it('fails closed when role is too low', async () => {
    await expect(
      requireProductRole(
        stubClient({
          user_id: 'u1',
          product_id: 'demo',
          role: 'viewer',
          functional_role: 'analyst',
        }),
        {
          userId: 'u1',
          productId: 'demo',
          minRole: 'owner',
        },
      ),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('requireProductAuth (#264)', () => {
  const stubClient = (
    row: { user_id: string; product_id: string; role: string; functional_role: string } | null,
  ) => {
    const maybeSingle = async () => ({ data: row, error: null })
    const eq2 = () => ({ maybeSingle })
    const eq1 = () => ({ eq: eq2 })
    const select = () => ({ eq: eq1 })
    return { from: () => ({ select }) } as never
  }

  it('allows an editor to cut when studio.edit is required', async () => {
    const membership = await requireProductAuth(
      stubClient({
        user_id: 'u1',
        product_id: 'demo',
        role: 'editor',
        functional_role: 'editor',
      }),
      { userId: 'u1', productId: 'demo', feature: 'studio.edit' },
    )
    expect(membership.functionalRole).toBe('editor')
  })

  it('blocks an analyst from publishing', async () => {
    await expect(
      requireProductAuth(
        stubClient({
          user_id: 'u1',
          product_id: 'demo',
          role: 'viewer',
          functional_role: 'analyst',
        }),
        { userId: 'u1', productId: 'demo', feature: 'studio.publish' },
      ),
    ).rejects.toMatchObject({ name: 'ProductAccessError', status: 403 })
  })

  it('allows a reviewer to sign off and blocks cut', async () => {
    const membership = await requireProductAuth(
      stubClient({
        user_id: 'u1',
        product_id: 'demo',
        role: 'editor',
        functional_role: 'reviewer',
      }),
      { userId: 'u1', productId: 'demo', feature: 'studio.review' },
    )
    expect(membership.functionalRole).toBe('reviewer')
    await expect(
      requireProductAuth(
        stubClient({
          user_id: 'u1',
          product_id: 'demo',
          role: 'editor',
          functional_role: 'reviewer',
        }),
        { userId: 'u1', productId: 'demo', feature: 'studio.edit' },
      ),
    ).rejects.toMatchObject({ status: 403 })
  })
})
