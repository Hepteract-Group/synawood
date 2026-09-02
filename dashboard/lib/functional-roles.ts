/** Job function on a Product member (ADR-0037). Distinct from tenancy role. */

export const FUNCTIONAL_ROLES = ['founder', 'editor', 'reviewer', 'publisher', 'analyst'] as const

export type FunctionalRole = (typeof FUNCTIONAL_ROLES)[number]

export const PRODUCT_FEATURES = [
  'studio.edit',
  'studio.approve_submit',
  'studio.review',
  'studio.publish',
  'insights.read',
  'outcomes.write',
  'members.manage',
] as const

export type ProductFeature = (typeof PRODUCT_FEATURES)[number]

export const isFunctionalRole = (value: unknown): value is FunctionalRole =>
  typeof value === 'string' && (FUNCTIONAL_ROLES as readonly string[]).includes(value)

export const defaultFunctionalRole = (tenancy: 'owner' | 'editor' | 'viewer'): FunctionalRole => {
  if (tenancy === 'owner') return 'founder'
  if (tenancy === 'editor') return 'editor'
  return 'analyst'
}

export const featuresForRole = (role: FunctionalRole): readonly ProductFeature[] => {
  switch (role) {
    case 'founder':
      return PRODUCT_FEATURES
    case 'editor':
      return ['studio.edit', 'studio.approve_submit', 'insights.read']
    case 'reviewer':
      return ['studio.review', 'insights.read']
    case 'publisher':
      return ['studio.publish', 'insights.read']
    case 'analyst':
      return ['insights.read', 'outcomes.write']
  }
}

export const hasFeature = (
  role: FunctionalRole | null | undefined,
  feature: ProductFeature,
): boolean => Boolean(role && featuresForRole(role).includes(feature))

export const INVITE_FUNCTIONAL_ROLES = ['editor', 'reviewer', 'publisher', 'analyst'] as const

export type InviteFunctionalRole = (typeof INVITE_FUNCTIONAL_ROLES)[number]

export const isInviteFunctionalRole = (value: unknown): value is InviteFunctionalRole =>
  typeof value === 'string' && (INVITE_FUNCTIONAL_ROLES as readonly string[]).includes(value)

export const resolveInviteFunctionalRole = (
  tenancy: 'editor' | 'viewer',
  stored?: string | null,
): FunctionalRole => {
  if (isInviteFunctionalRole(stored)) return stored
  return defaultFunctionalRole(tenancy)
}

/** Analysts browse; every other invite job function needs editor tenancy to open Studio. */
export const tenancyForInviteFunctionalRole = (role: InviteFunctionalRole): 'editor' | 'viewer' =>
  role === 'analyst' ? 'viewer' : 'editor'

export const FUNCTIONAL_ROLE_LABEL: Record<FunctionalRole, string> = {
  founder: 'Founder',
  editor: 'Editor',
  reviewer: 'Reviewer',
  publisher: 'Publisher',
  analyst: 'Analyst',
}

export const FUNCTIONAL_ROLE_HINT: Record<FunctionalRole, string> = {
  founder: 'All job functions in this organization',
  editor: 'Cut, chat, and submit for Approve',
  reviewer: 'Sign-off stages — no cut or publish',
  publisher: 'Publish after Final',
  analyst: 'Outcomes and insights only',
}

export const PRODUCT_FEATURE_LABEL: Record<ProductFeature, string> = {
  'studio.edit': 'Cut and chat in Studio',
  'studio.approve_submit': 'Submit for Approve',
  'studio.review': 'Sign off review stages',
  'studio.publish': 'Publish after Final',
  'insights.read': 'Read insights',
  'outcomes.write': 'Record outcomes',
  'members.manage': 'Invite people and change job functions',
}
