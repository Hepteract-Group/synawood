'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'
import { AUTH_COOKIE_NAME } from '../../../lib/auth-cookie'
import { authBrowserCookieOptions } from '../../../lib/auth-browser-cookie'
import { POST_AUTH_NEXT_COOKIE } from '../../../lib/auth-post-auth-cookie'
import { resolvePostAuthPath } from '../../../lib/auth-next-path'
import { readStandaloneDisplay } from '../../../lib/display-mode'

/**
 * Exchange the OAuth `code` in the browser so the PKCE verifier cookie
 * (set when Continue with Google started) is on the same host/jar.
 *
 * Module-level single-flight: React Strict Mode remounts must not cancel a
 * successful exchange or redeem the same code twice (flow_state_already_used).
 */

const readPostAuthNext = (): string => {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${POST_AUTH_NEXT_COOKIE}=`))
  const standalone = { standalone: readStandaloneDisplay() }
  if (!match) return resolvePostAuthPath(null, standalone)
  try {
    return resolvePostAuthPath(decodeURIComponent(match.split('=').slice(1).join('=')), standalone)
  } catch {
    return resolvePostAuthPath(null, standalone)
  }
}

const clearPostAuthNext = () => {
  document.cookie = `${POST_AUTH_NEXT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

const failToLogin = (error: string, nextPath: string, detail?: string) => {
  const login = new URL('/login', window.location.origin)
  login.searchParams.set('error', error)
  login.searchParams.set('next', nextPath)
  if (detail) {
    login.searchParams.set('detail', detail.slice(0, 160))
  }
  window.location.replace(login.pathname + login.search)
}

const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createBrowserClient(url, anonKey, {
    cookieOptions: authBrowserCookieOptions,
  })
}

const redeemOAuthCode = async (): Promise<void> => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const nextPath = resolvePostAuthPath(params.get('next') ?? readPostAuthNext(), {
    standalone: readStandaloneDisplay(),
  })

  if (!code) {
    failToLogin('missing_code', nextPath)
    return
  }

  const client = createClient()
  if (!client) {
    failToLogin('auth_not_configured', nextPath)
    return
  }

  const {
    data: { session: existing },
  } = await client.auth.getSession()

  if (!existing) {
    const hasVerifier = document.cookie.includes(`${AUTH_COOKIE_NAME}-code-verifier`)
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (error) {
      // First Strict Mode pass may have already redeemed the code and set cookies.
      const {
        data: { session: afterFail },
      } = await client.auth.getSession()
      if (!afterFail) {
        console.error('[auth/callback] exchange failed', error.message, {
          hasVerifier,
        })
        const hint = hasVerifier
          ? error.message
          : `${error.message} (missing PKCE cookie — use http://localhost:3000 only)`
        failToLogin('oauth_exchange_failed', nextPath, hint)
        return
      }
    }
  }

  const {
    data: { user },
  } = await client.auth.getUser()

  const allowRes = await fetch('/api/auth/allowlist-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user?.email ?? '' }),
  })
  const allowBody = (await allowRes.json().catch(() => null)) as {
    allowed?: boolean
  } | null

  if (!allowRes.ok || !allowBody?.allowed) {
    await client.auth.signOut()
    failToLogin('not_allowlisted', nextPath)
    return
  }

  clearPostAuthNext()
  window.location.replace(nextPath)
}

/** Survives React Strict Mode remount within the same document. */
let inflight: Promise<void> | null = null
let inflightCode: string | null = null

const AuthCallbackPage = () => {
  const [message] = useState('Signing you in…')

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!inflight || inflightCode !== code) {
      inflightCode = code
      inflight = redeemOAuthCode().catch((err) => {
        console.error('[auth/callback]', err)
        const nextPath = resolvePostAuthPath(readPostAuthNext(), {
          standalone: readStandaloneDisplay(),
        })
        failToLogin(
          'oauth_exchange_failed',
          nextPath,
          err instanceof Error ? err.message : 'unknown',
        )
      })
    }
  }, [])

  return (
    <main className="auth-shell" aria-busy="true">
      <p className="auth-lede" role="status">
        {message}
      </p>
    </main>
  )
}

export default AuthCallbackPage
