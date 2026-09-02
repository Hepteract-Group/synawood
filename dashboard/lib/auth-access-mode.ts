/** Who may create a session (ADR-0067). Unset = today’s allowlist-or-invite gate. */

export type AuthAccessMode = 'saas' | 'invite_or_allowlist' | 'allowlist'

export type AccessModeEnv = {
  AUTH_ACCESS_MODE?: string
}

export const parseAuthAccessMode = (raw: string | undefined): AuthAccessMode => {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'saas' || value === 'allowlist' || value === 'invite_or_allowlist') {
    return value
  }
  return 'invite_or_allowlist'
}

export const getAuthAccessMode = (env: object = process.env): AuthAccessMode =>
  parseAuthAccessMode('AUTH_ACCESS_MODE' in env ? String(env.AUTH_ACCESS_MODE ?? '') : undefined)

export const emailMayAuthenticate = (input: {
  mode: AuthAccessMode
  allowlisted: boolean
  hasOpenInvite: boolean
}): boolean => {
  if (input.mode === 'saas') return true
  if (input.allowlisted) return true
  if (input.mode === 'allowlist') return false
  return input.hasOpenInvite
}
