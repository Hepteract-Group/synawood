'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { rememberActiveProductId } from '../../../lib/active-product-cookie'
import { PRODUCT_MARK, PRODUCT_NAME } from '../../../lib/product-name'

type InvitePreview = {
  productId: string
  productName: string
  email: string
  role: string
  functionalRole?: string
  expiresAt: string | null
  acceptedAt: string | null
}

export const InviteAcceptPanel = () => {
  const params = useParams<{ token: string }>()
  const token = typeof params.token === 'string' ? params.token : ''
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setError('Missing invite token.')
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      const response = await fetch(`/api/invites/${encodeURIComponent(token)}`)
      const body = (await response.json().catch(() => null)) as
        (InvitePreview & { error?: string }) | null
      if (cancelled) return
      if (!response.ok || !body?.productId) {
        setError(body?.error ?? 'Invite not found. Ask an owner for a new link.')
        setLoading(false)
        return
      }
      setPreview(body)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const onAccept = async () => {
    setError(null)
    setPending(true)
    try {
      const response = await fetch(`/api/invites/${encodeURIComponent(token)}`, { method: 'POST' })
      const body = (await response.json().catch(() => null)) as {
        productId?: string
        error?: string
      } | null
      if (!response.ok || !body?.productId) {
        throw new Error(body?.error ?? 'Could not accept invite.')
      }
      rememberActiveProductId(body.productId)
      window.location.assign('/studio')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPending(false)
    }
  }

  return (
    <div className="auth-shell">
      <Link href="/" className="auth-brand">
        <span className="auth-brand-mark" aria-hidden>
          {PRODUCT_MARK}
        </span>
        <span>{PRODUCT_NAME}</span>
      </Link>
      <section className="auth-panel" aria-labelledby="invite-title">
        <h1 id="invite-title">Join this organization</h1>
        {loading ? <p className="auth-lede">Loading invite…</p> : null}
        {!loading && preview ? (
          <>
            <p className="auth-lede">
              You are invited to <strong>{preview.productName}</strong> as{' '}
              <strong>{preview.functionalRole ?? preview.role}</strong>. Sign-in email must match{' '}
              <strong>{preview.email}</strong>.
            </p>
            {preview.acceptedAt ? (
              <p className="auth-error" role="status">
                This invite was already accepted.
              </p>
            ) : (
              <button
                type="button"
                className="auth-submit"
                onClick={onAccept}
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? 'Joining…' : 'Accept invite'}
              </button>
            )}
          </>
        ) : null}
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="auth-foot">
          Wrong account? <Link href="/login">Sign in</Link> with the invited email.
        </p>
      </section>
    </div>
  )
}
