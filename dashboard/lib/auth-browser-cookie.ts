/** Shared cookie options for Synawood Auth sessions (browser + server). */
import { AUTH_COOKIE_NAME } from './auth-cookie'

export const authCookieOptions = {
  name: AUTH_COOKIE_NAME,
  path: '/',
  sameSite: 'lax' as const,
}

/** Prefer authCookieOptions; kept for existing imports. */
export const authBrowserCookieOptions = authCookieOptions

export const applyAuthCookies = (
  response: {
    cookies: {
      set: (name: string, value: string, options?: Record<string, unknown>) => void
    }
  },
  cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
): void => {
  for (const { name, value, options } of cookiesToSet) {
    // Drop `domain` — browsers reject Domain=localhost and host mismatches
    // (localhost vs 127.0.0.1) silently drop the session cookie.
    const { domain: _domain, name: _name, ...rest } = (options ?? {}) as Record<string, unknown>
    response.cookies.set(name, value, {
      ...rest,
      path: '/',
      sameSite: 'lax',
      // Hosted HTTPS only — `secure: true` on http://localhost drops the cookie.
      secure: process.env.VERCEL === '1',
    })
  }
}
