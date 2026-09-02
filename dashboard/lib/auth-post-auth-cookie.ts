import { DEFAULT_POST_AUTH_PATH, resolvePostAuthPath } from './auth-next-path'

/** Short-lived cookie so OAuth redirectTo stays exact (`/auth/callback`, no query). */
export const POST_AUTH_NEXT_COOKIE = 'mos-post-auth-next'

export const rememberPostAuthPath = (path: string): void => {
  const safe = resolvePostAuthPath(path)
  document.cookie = `${POST_AUTH_NEXT_COOKIE}=${encodeURIComponent(safe)}; Path=/; Max-Age=600; SameSite=Lax`
}

export const readPostAuthPathCookie = (cookies: {
  get: (name: string) => { value: string } | undefined
}): string => {
  const raw = cookies.get(POST_AUTH_NEXT_COOKIE)?.value
  if (!raw) return DEFAULT_POST_AUTH_PATH
  try {
    return resolvePostAuthPath(decodeURIComponent(raw))
  } catch {
    return DEFAULT_POST_AUTH_PATH
  }
}

export const clearPostAuthPathCookie = (response: {
  cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void }
}): void => {
  response.cookies.set(POST_AUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 })
}
