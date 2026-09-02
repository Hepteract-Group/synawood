/** Founder allowlist for v1 signup/login (ADR-0024 / Plan 07). */

export type AllowlistEnv = {
  AUTH_ALLOWLIST_EMAILS?: string
  AUTH_ACCESS_MODE?: string
  NODE_ENV?: string
  VERCEL_ENV?: string
}

export const parseAllowlistEmails = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)

/** Production with an empty allowlist fails closed (deny). Local/dev empty = open. */
export const isProductionAuth = (env: AllowlistEnv): boolean =>
  env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production'

export const isEmailAllowlisted = (
  email: string | null | undefined,
  env: AllowlistEnv = process.env,
): boolean => {
  if (!email?.trim()) return false
  const list = parseAllowlistEmails(env.AUTH_ALLOWLIST_EMAILS)
  if (list.length === 0) {
    return !isProductionAuth(env)
  }
  return list.includes(email.trim().toLowerCase())
}

export const ALLOWLIST_DENIED_MESSAGE =
  'Access is invite-only for now. Join the waitlist on the home page, or ask an owner for an invite.'
