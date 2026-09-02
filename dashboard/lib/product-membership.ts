import type { SupabaseClient } from '@supabase/supabase-js'
import {
  hasFeature,
  isFunctionalRole,
  type FunctionalRole,
  type ProductFeature,
} from './functional-roles'

export const PRODUCT_ROLES = ['viewer', 'editor', 'owner'] as const
export type ProductRole = (typeof PRODUCT_ROLES)[number]

export type ProductMembership = {
  userId: string
  productId: string
  role: ProductRole
  functionalRole: FunctionalRole
}

/** viewer < editor < owner. Unknown / empty → 0 (fail closed). */
export const productRoleRank = (role: string | null | undefined): number => {
  switch (role) {
    case 'viewer':
      return 1
    case 'editor':
      return 2
    case 'owner':
      return 3
    default:
      return 0
  }
}

export const isProductRole = (value: unknown): value is ProductRole =>
  typeof value === 'string' && (PRODUCT_ROLES as readonly string[]).includes(value)

/** True when `actual` meets or exceeds `minimum`. Missing membership fails closed. */
export const hasMinProductRole = (
  actual: ProductRole | null | undefined,
  minimum: ProductRole,
): boolean => productRoleRank(actual) >= productRoleRank(minimum)

export class ProductAccessError extends Error {
  readonly status: number

  constructor(message: string, status = 403) {
    super(message)
    this.name = 'ProductAccessError'
    this.status = status
  }
}

export const loadProductMembership = async (
  supabase: SupabaseClient,
  input: { userId: string; productId: string },
): Promise<ProductMembership | null> => {
  const { data, error } = await supabase
    .from('product_members')
    .select('user_id, product_id, role, functional_role')
    .eq('user_id', input.userId)
    .eq('product_id', input.productId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load product membership: ${error.message}`)
  }
  if (!data || !isProductRole(data.role) || !isFunctionalRole(data.functional_role)) {
    return null
  }
  return {
    userId: data.user_id as string,
    productId: data.product_id as string,
    role: data.role,
    functionalRole: data.functional_role,
  }
}

/**
 * Fail-closed gate for product-scoped APIs.
 * Throws ProductAccessError when the user is not a member at the required role.
 */
export const requireProductRole = async (
  supabase: SupabaseClient,
  input: { userId: string; productId: string; minRole: ProductRole },
): Promise<ProductMembership> => {
  const membership = await loadProductMembership(supabase, input)
  if (!membership || !hasMinProductRole(membership.role, input.minRole)) {
    throw new ProductAccessError(
      `Requires ${input.minRole} access to product ${input.productId}`,
      403,
    )
  }
  return membership
}

/**
 * Tenancy + job-function gate (ADR-0037 / #264).
 * `minRole` is owner/editor/viewer. `feature` is the functional capability.
 */
export const requireProductAuth = async (
  supabase: SupabaseClient,
  input: {
    userId: string
    productId: string
    minRole?: ProductRole
    feature?: ProductFeature
  },
): Promise<ProductMembership> => {
  const membership = await requireProductRole(supabase, {
    userId: input.userId,
    productId: input.productId,
    minRole: input.minRole ?? 'viewer',
  })
  if (input.feature && !hasFeature(membership.functionalRole, input.feature)) {
    throw new ProductAccessError(`Requires ${input.feature} on product ${input.productId}`, 403)
  }
  return membership
}
