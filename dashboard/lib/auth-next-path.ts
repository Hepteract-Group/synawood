/** Reject open redirects: only same-origin relative paths. */
export const isSafeNextPath = (value: string | null | undefined): value is string => {
  if (!value || typeof value !== 'string') return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.includes('\\')) return false
  return true
}

export const DEFAULT_POST_AUTH_PATH = '/studio'
/** Installed PWA with no `next` query lands on Home, matching `start_url` (#843). */
export const STANDALONE_POST_AUTH_PATH = '/home'

/** Public marketing/auth entry paths must not be post-login destinations. */
const isPublicAuthSurface = (path: string): boolean => {
  const pathname = path.split('?')[0] ?? path
  return (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/signup/')
  )
}

/** Safe operator destination after login/signup/OAuth. */
export const resolvePostAuthPath = (
  value: string | null | undefined,
  options?: { standalone?: boolean },
): string => {
  if (!isSafeNextPath(value) || isPublicAuthSurface(value)) {
    return options?.standalone ? STANDALONE_POST_AUTH_PATH : DEFAULT_POST_AUTH_PATH
  }
  return value
}

/** New accounts create a Product before Studio (ADR-0024). Keep invite deep-links. */
export const resolveSignupDestination = (value: string | null | undefined): string => {
  const resolved = resolvePostAuthPath(value)
  if (resolved.startsWith('/invite/')) return resolved
  return '/onboarding'
}
