/**
 * Heuristic auth-wall detector for redirect chains.
 * Matches the two most common patterns: cross-domain redirect (e.g. app.example.com →
 * auth.example.com) and same-domain login/auth paths. Not exhaustive — unusual paths
 * like content-based detection (password input) are out of scope for v1.
 * ADR-0089 §2: skip pages that redirect to auth.
 */
const AUTH_PATH_RE =
  /\/(login|signin|sign-in|sign_in|auth|account\/login|session\/new|users\/sign_in|sso|oidc)/i

/**
 * Returns true when the final URL after a redirect looks like an auth wall.
 * Cross-domain hostname change always triggers; www vs apex does not.
 * Same-domain checks the path regex.
 */
export const isAuthWall = (originalUrl: string, finalUrl: string): boolean => {
  let original: URL
  let final: URL
  try {
    original = new URL(originalUrl)
    final = new URL(finalUrl)
  } catch {
    return false
  }
  if (final.hostname !== original.hostname) {
    const sameSite =
      final.hostname.replace(/^www\./, '') === original.hostname.replace(/^www\./, '')
    if (!sameSite) return true
  }
  return AUTH_PATH_RE.test(final.pathname)
}
