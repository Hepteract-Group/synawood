'use client'

import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { FormEvent, useId, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GoogleMark } from '../../components/auth/GoogleMark'
import { authBrowserCookieOptions } from '../../lib/auth-browser-cookie'
import { resolvePostAuthPath, resolveSignupDestination } from '../../lib/auth-next-path'
import { rememberPostAuthPath } from '../../lib/auth-post-auth-cookie'
import { PRODUCT_MARK, PRODUCT_NAME } from '../../lib/product-name'

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

export const SignupForm = () => {
  const searchParams = useSearchParams()
  const nextPath = resolveSignupDestination(searchParams.get('next'))
  const loginNext = resolvePostAuthPath(searchParams.get('next'))
  const emailId = useId()
  const nameId = useId()
  const passwordId = useId()
  const passwordHintId = useId()
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      rememberPostAuthPath(nextPath)
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
      const { error: signUpError } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      })
      if (signUpError) {
        throw signUpError
      }
      const { error: signInError } = await client.auth.signInWithPassword({ email, password })
      if (signInError) {
        throw new Error(
          'Account created. If you cannot sign in yet, confirm your email, then try again.',
        )
      }
      leaveAuthPage(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPending(false)
    }
  }

  const busy = pending || oauthPending

  return (
    <div className="auth-shell">
      <a href="#auth-main" className="skip-link">
        Skip to create account
      </a>
      <Link href="/" className="auth-brand">
        <span className="auth-brand-mark" aria-hidden>
          {PRODUCT_MARK}
        </span>
        <span>{PRODUCT_NAME}</span>
      </Link>
      <section id="auth-main" className="auth-panel auth-panel-signup" aria-labelledby="auth-title">
        <h1 id="auth-title">Create account</h1>
        <p className="auth-notice" role="note">
          Invite-only for now. If you do not have an invite, <Link href="/">join the waitlist</Link>{' '}
          instead.
        </p>
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
        <form onSubmit={onSubmit} className="auth-form" aria-busy={pending} noValidate>
          <label htmlFor={nameId}>
            Name
            <input
              id={nameId}
              type="text"
              required
              autoComplete="name"
              maxLength={80}
              placeholder="Ada Lovelace"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>
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
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={`${passwordHintId}${error ? ` ${errorId}` : ''}`}
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
            <p id={passwordHintId} className="auth-field-hint">
              Use at least 8 characters.
            </p>
          </div>
          {error ? (
            <p id={errorId} className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="auth-submit" disabled={busy} aria-busy={pending}>
            {pending ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-foot">
          Already have an account?{' '}
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`}>Sign in</Link>
        </p>
      </section>
    </div>
  )
}
