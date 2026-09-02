import { FUNCTIONAL_ROLES, type FunctionalRole } from './functional-roles'

/** Plan SKUs for job-function inclusion. Billing checkout is out of scope (ADR-0037 §5). */
export const PRODUCT_PLANS = ['founding', 'preview'] as const

export type ProductPlan = (typeof PRODUCT_PLANS)[number]

export const isProductPlan = (value: unknown): value is ProductPlan =>
  typeof value === 'string' && (PRODUCT_PLANS as readonly string[]).includes(value)

export const resolveProductPlan = (raw: string | undefined): ProductPlan =>
  isProductPlan(raw) ? raw : 'founding'

export const PLAN_LABEL: Record<ProductPlan, string> = {
  founding: 'Founding',
  preview: 'Preview',
}

export const PLAN_ROLES: Record<ProductPlan, readonly FunctionalRole[]> = {
  founding: FUNCTIONAL_ROLES,
  preview: ['editor', 'analyst'],
}

export const rolesIncludedOnPlan = (plan: ProductPlan): readonly FunctionalRole[] =>
  PLAN_ROLES[plan]

export const planIncludesRole = (plan: ProductPlan, role: FunctionalRole): boolean =>
  PLAN_ROLES[plan].includes(role)
