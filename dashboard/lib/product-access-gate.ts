import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthAccessMode } from './auth-access-mode'
import { isEmailAllowlisted, type AllowlistEnv } from './auth-allowlist'

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

export const hasPendingInviteForEmail = async (
  supabase: SupabaseClient,
  email: string,
): Promise<boolean> => {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('product_invites')
    .select('id')
    .eq('email', normalized)
    .is('accepted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .limit(1)

  if (error) {
    throw new Error(`Failed to check invites: ${error.message}`)
  }
  return (data?.length ?? 0) > 0
}

export const countMembershipsForUser = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from('product_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    throw new Error(`Failed to count memberships: ${error.message}`)
  }
  return count ?? 0
}

export type AppAccess = {
  allowed: boolean
  membershipCount: number
}

export type ProtectedNavigation = 'allow' | 'profile' | 'onboarding' | 'deny'

/** One membership lookup (and invite only when needed) for middleware. */
export const resolveAppAccess = async (
  supabase: SupabaseClient,
  input: { userId: string; email: string | null | undefined },
  env: AllowlistEnv = process.env,
): Promise<AppAccess> => {
  const mode = getAuthAccessMode(env)
  const membershipCount = await countMembershipsForUser(supabase, input.userId)
  if (mode === 'saas') return { allowed: true, membershipCount }
  const allowlisted = isEmailAllowlisted(input.email, env)
  if (allowlisted) return { allowed: true, membershipCount }
  if (!input.email?.trim()) return { allowed: false, membershipCount }
  if (membershipCount > 0) return { allowed: true, membershipCount }
  if (mode === 'allowlist') return { allowed: false, membershipCount }
  return {
    allowed: await hasPendingInviteForEmail(supabase, input.email),
    membershipCount,
  }
}

/** Allowlisted, existing member, or open invite — may establish a session. */
export const userMayAccessApp = async (
  supabase: SupabaseClient,
  input: { userId: string; email: string | null | undefined },
  env: AllowlistEnv = process.env,
): Promise<boolean> => (await resolveAppAccess(supabase, input, env)).allowed

export const decideProtectedNavigation = (input: {
  allowed: boolean
  membershipCount: number
  onboardingExempt: boolean
  profileComplete: boolean
  profileExempt: boolean
}): ProtectedNavigation => {
  if (!input.allowed) return 'deny'
  if (!input.profileComplete && !input.profileExempt) return 'profile'
  if (input.membershipCount === 0 && !input.onboardingExempt) return 'onboarding'
  return 'allow'
}
