'use client'

import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { FormEvent, useEffect, useId, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GoogleMark } from '../../components/auth/GoogleMark'
import { authBrowserCookieOptions } from '../../lib/auth-browser-cookie'
import { LoginInstallTip } from '../../components/InstallHint'
import { resolvePostAuthPath } from '../../lib/auth-next-path'
import { rememberPostAuthPath } from '../../lib/auth-post-auth-cookie'
import { readStandaloneDisplay } from '../../lib/display-mode'
import { PRODUCT_MARK, PRODUCT_NAME } from '../../lib/product-name'

const oauthErrorMessage = (code: string | null, detail: string | null): string | null => {
  if (!code) return null
  switch (code) {
    case 'missing_code':
      return 'Google sign-in did not finish. Try again.'
    case 'auth_not_configured':
      return 'Sign-in is temporarily unavailable. Try again shortly.'
    case 'oauth_exchange_failed':
      return detail
        ? `Could not complete Google sign-in (${detail}). Try again or use email.`
        : 'Could not complete Google sign-in. Try again or use email.'
    case 'not_allowlisted':
      return 'Access is invite-only for now. Join the waitlist on the home page.'
    default:
      return 'Sign-in failed. Try again.'
  }
}

const assertAllowlisted = async (email: string) => {
  const response = await fetch('/api/auth/allowlist-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const body = (await response.json().catch(() => null)) as {
    allowed?: boolean
    error?: string
  } | null
  if (!response.ok || !body?.allowed) {
    throw new Error(
      body?.error ?? 'Access is invite-only for now. Join the waitlist on the home page.',
    )
  }
}

const leaveAuthPage = (nextPath: string) => {
  window.location.assign(nextPath)
}

export const LoginForm = () => {
  const searchParams = useSearchParams()
  const requestedNext = searchParams.get('next')
  const nextPath = resolvePostAuthPath(requestedNext)
  const postAuthPath = () =>
    resolvePostAuthPath(requestedNext, { standalone: readStandaloneDisplay() })
  const [signupNext, setSignupNext] = useState(nextPath)
  useEffect(() => {
    setSignupNext(postAuthPath())
  }, [requestedNext])

  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    oauthErrorMessage(searchParams.get('error'), searchParams.get('detail')),
  )
  const [pending, setPending] = useState(false)
  const [oauthPending, setOauthPending] = useState(false)

  const supabaseConfigured = useMemo(
    () =>
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    [],
  )

  const client = useMemo(() => {
    if (!supabaseConfigured) return null
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: authBrowserCookieOptions },
    )
  }, [supabaseConfigured])

  const onGoogle = async () => {
    setError(null)
    setOauthPending(true)
    try {
      if (!client) {
        throw new Error('Sign-in is temporarily unavailable. Try again shortly.')
      }
      rememberPostAuthPath(postAuthPath())
      // Keep redirectTo exact — query strings can make GoTrue fall back to site_url (`/?code=`).
      // skipBrowserRedirect so the PKCE verifier cookie is written before leaving the page.
      const redirectTo = new URL('/auth/callback', window.location.origin).toString()
      const { data, error: oauthError } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (oauthError) {
        throw oauthError
      }
      if (!data.url) {
        throw new Error('Google sign-in did not return a redirect URL.')
      }
      window.location.assign(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setOauthPending(false)
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (!client) {
        throw new Error('Sign-in is temporarily unavailable. Try again shortly.')
      }
      await assertAllowlisted(email)
      const { error: signInError } = await client.auth.signInWithPassword({ email, password })
      if (signInError) {
        throw signInError
      }
      leaveAuthPage(postAuthPath())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPending(false)
    }
  }

  const busy = pending || oauthPending

  return (
    <div className="auth-shell">
      <a href="#auth-main" className="skip-link">
        Skip to sign in
      </a>
      <Link href="/" className="auth-brand">
        <span className="auth-brand-mark" aria-hidden>
          {PRODUCT_MARK}
        </span>
        <span>{PRODUCT_NAME}</span>
      </Link>
      <section id="auth-main" className="auth-panel" aria-labelledby="auth-title">
        <h1 id="auth-title">Sign in</h1>
        <p className="auth-lede">Invite-only for now. Founders and invited members can sign in.</p>
        <div className="auth-stack">
          <button
            type="button"
            className="auth-google"
            onClick={onGoogle}
            disabled={busy}
            aria-busy={oauthPending}
          >
            <GoogleMark />
            <span>{oauthPending ? 'Redirecting to Google…' : 'Continue with Google'}</span>
          </button>
          <div className="auth-or" role="separator" aria-label="or use email">
            <span>or use email</span>
          </div>
        </div>
        <form onSubmit={onSubmit} className="auth-form" aria-busy={pending}>
          <label htmlFor={emailId}>
            Email
            <input
              id={emailId}
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          </label>
          <div className="auth-field">
            <label htmlFor={passwordId}>Password</label>
            <div className="auth-password-row">
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error ? (
            <p id={errorId} className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="auth-submit" disabled={busy} aria-busy={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-foot">
          No account?{' '}
          <Link href={`/signup?next=${encodeURIComponent(signupNext)}`}>Create one</Link>
          {' · '}
          <Link href="/">Waitlist</Link>
        </p>
        <LoginInstallTip />
      </section>
    </div>
  )
}
