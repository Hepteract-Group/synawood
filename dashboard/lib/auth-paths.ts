/** Pure path rules for middleware — unit-tested without Next runtime. */

const PUBLIC_EXACT = new Set([
  '/',
  '/login',
  '/signup',
  '/access-denied',
  '/api/health',
  '/api/waitlist',
  '/api/auth/allowlist-check',
  '/manifest.webmanifest',
  // Unique-origin Studio iframe (no cookies). Static host — compiled TSX arrives via postMessage.
  '/authored-player.html',
  '/authored-player.js',
])
const PUBLIC_PREFIXES = ['/auth/callback', '/api/v1']

export const isPublicPath = (pathname: string): boolean => {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Fail closed: every non-public path requires a session.
 * New operator UI or `/api/*` routes are protected by default.
 */
export const isProtectedPath = (pathname: string): boolean => !isPublicPath(pathname)

/** `next` after unauthenticated hit of a protected path. PWA start_url is `/home`, not `/`. */
export const unauthenticatedLoginNext = (pathname: string): string => {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/home'
  return pathname
}

/**
 * Signed-in users with zero Product memberships may only hit these paths
 * until they create or join a Product (#103).
 */
export const isOnboardingExemptPath = (pathname: string): boolean => {
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) return true
  if (pathname === '/products' || pathname.startsWith('/products/')) return true
  if (pathname === '/invite' || pathname.startsWith('/invite/')) return true
  if (pathname === '/access-denied' || pathname.startsWith('/access-denied/')) return true
  if (pathname === '/api/products' || pathname.startsWith('/api/products/')) return true
  if (pathname === '/api/invites' || pathname.startsWith('/api/invites/')) return true
  if (pathname === '/api/me/profile' || pathname.startsWith('/api/me/profile/')) return true
  if (pathname === '/api/me/session' || pathname.startsWith('/api/me/session/')) return true
  if (pathname === '/api/me/guides' || pathname.startsWith('/api/me/guides/')) return true
  if (pathname === '/api/auth/allowlist-check') return true
  if (pathname.startsWith('/auth/callback')) return true
  if (pathname === '/login' || pathname === '/signup') return true
  return false
}

/**
 * Next middleware matcher pattern — unit-tested here.
 * `dashboard/middleware.ts` must use the same string as a **static literal**
 * in `export const config` (Next.js forbids spreads/imports in that export).
 */
export const MIDDLEWARE_MATCHER = [
  '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
] as const
