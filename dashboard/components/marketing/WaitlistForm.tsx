'use client'

import Link from 'next/link'
import { FormEvent, useId, useState } from 'react'

export const WaitlistForm = () => {
  const emailId = useId()
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<'sent' | 'saved' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        emailSent?: boolean
      } | null
      if (!response.ok) {
        throw new Error(body?.error ?? 'Could not join the waitlist. Try again.')
      }
      setDone(body?.emailSent ? 'sent' : 'saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <p className="mkt-waitlist-success" role="status" aria-live="polite">
        {done === 'sent'
          ? 'You are on the list. Confirmation sent. This is not dashboard access.'
          : 'You are on the list. This is not dashboard access.'}
      </p>
    )
  }

  return (
    <form className="mkt-waitlist" onSubmit={onSubmit} aria-busy={pending}>
      <label className="sr-only" htmlFor={emailId}>
        Work email
      </label>
      <input
        id={emailId}
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={pending}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Joining…' : 'Join the waitlist'}
      </button>
      {error ? (
        <p id={errorId} className="mkt-waitlist-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mkt-waitlist-hint">
        Already have access?{' '}
        <Link href="/login?next=/studio" className="mkt-signin-link">
          Sign in
        </Link>
      </p>
    </form>
  )
}
