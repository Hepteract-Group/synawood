'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  readActiveProductIdFromDocument,
  rememberActiveProductId,
} from '@/lib/active-product-cookie'
import { readApiJson } from '@/lib/read-api-json'
import { slugifyProductName } from '@/lib/product-slug'

type ProductRole = 'owner' | 'editor' | 'viewer'

type Membership = {
  productId: string
  role: ProductRole
  product: { id: string; slug: string; name: string }
}

const roleLabel = (role: ProductRole): string => {
  switch (role) {
    case 'owner':
      return 'Owner'
    case 'editor':
      return 'Editor'
    case 'viewer':
      return 'Viewer'
  }
}

const extractInviteToken = (raw: string): string =>
  raw
    .trim()
    .replace(/^.*\/invite\//, '')
    .replace(/[?#].*$/, '')

export const ProductsWorkspace = () => {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [inviteToken, setInviteToken] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const nameRef = useRef<HTMLInputElement | null>(null)
  const inviteRef = useRef<HTMLInputElement | null>(null)
  const nameId = useId()
  const slugId = useId()
  const inviteId = useId()
  const formErrorId = useId()

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/products')
      const body = await readApiJson<{
        memberships?: Membership[]
        error?: string
      }>(response)
      if (!response.ok) {
        throw new Error(body.error ?? 'Could not load Products.')
      }
      const list = body.memberships ?? []
      setMemberships(list)
      const cookieId = readActiveProductIdFromDocument()
      const stillValid = cookieId && list.some((item) => item.productId === cookieId)
      setActiveId(stillValid ? cookieId : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Products.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (!slugTouched) setSlug(slugifyProductName(name))
  }, [name, slugTouched])

  useEffect(() => {
    if (!createOpen) return
    nameRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) closeCreate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [createOpen, pending])

  useEffect(() => {
    if (!inviteOpen) return
    inviteRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) closeInvite()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inviteOpen, pending])

  const openCreate = () => {
    setName('')
    setSlug('')
    setSlugTouched(false)
    setFormError(null)
    setCreateOpen(true)
  }

  const closeCreate = () => {
    if (pending) return
    setCreateOpen(false)
    setFormError(null)
  }

  const openInvite = () => {
    setInviteToken('')
    setFormError(null)
    setInviteOpen(true)
  }

  const closeInvite = () => {
    if (pending) return
    setInviteOpen(false)
    setFormError(null)
  }

  const activateProduct = (productId: string, label: string) => {
    rememberActiveProductId(productId)
    setActiveId(productId)
    setStatus(`${label} is ready.`)
  }

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setPending(true)
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      })
      const body = await readApiJson<{
        product?: { id: string; name: string; slug: string }
        error?: string
      }>(response)
      if (!response.ok || !body.product) {
        throw new Error(body.error ?? 'Could not create Product.')
      }
      rememberActiveProductId(body.product.id)
      setActiveId(body.product.id)
      setCreateOpen(false)
      setStatus(`${body.product.name} is ready.`)
      await refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create Product.')
    } finally {
      setPending(false)
    }
  }

  const onInvite = (event: FormEvent) => {
    event.preventDefault()
    const token = extractInviteToken(inviteToken)
    if (!token) {
      setFormError('Paste an invite link or token from a Product owner.')
      return
    }
    window.location.assign(`/invite/${encodeURIComponent(token)}`)
  }

  const empty = !loading && !error && memberships.length === 0

  return (
    <section className="panel products-page mos-enter">
      <header className="products-header">
        <div className="products-header-copy">
          <p className="eyebrow">Products</p>
          <h1 className="products-title">Your Products</h1>
          <p className="page-lede">
            The brands and lines you make ads for — pick one to open Studio.
          </p>
        </div>
        <div className="products-header-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Create Product
          </button>
          <button type="button" className="btn btn-ghost" onClick={openInvite}>
            Join with invite
          </button>
        </div>
      </header>

      {status ? (
        <p className="products-status" role="status" aria-live="polite">
          {status}{' '}
          {activeId ? (
            <Link href="/studio" className="products-inline-link">
              Open Studio
            </Link>
          ) : null}
        </p>
      ) : null}

      {loading ? (
        <p className="page-lede" role="status" aria-live="polite">
          Loading Products…
        </p>
      ) : null}

      {error === 'Unauthorized' ? (
        <p className="error">
          <Link href="/login?next=/products">Sign in</Link> to manage Products.
        </p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : null}

      {empty ? (
        <div className="products-empty">
          <h2 className="products-empty-title">Start with a Product</h2>
          <p className="page-lede">
            Create one for the brand you ship ads for — or join with an invite from a teammate.
          </p>
          <div className="products-empty-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Create your first Product
            </button>
            <button type="button" className="btn btn-ghost" onClick={openInvite}>
              I have an invite
            </button>
          </div>
        </div>
      ) : null}

      {!loading && memberships.length > 0 ? (
        <ul className="products-list mos-stagger">
          {memberships.map((item) => {
            const isActive = item.productId === activeId
            const mark = (item.product.name.trim().charAt(0) || '?').toUpperCase()
            return (
              <li key={item.productId} className={`products-card${isActive ? ' is-active' : ''}`}>
                {isActive ? <span className="products-active-pill">Active</span> : null}
                <span className="products-card-mark" aria-hidden>
                  {mark}
                </span>
                <div className="products-card-body">
                  <h2 className="products-card-name">{item.product.name}</h2>
                  <p className="products-card-meta">
                    <span translate="no">{item.product.slug}</span>
                    <span aria-hidden> · </span>
                    <span>{roleLabel(item.role)}</span>
                  </p>
                </div>
                <div className="products-card-actions">
                  {isActive ? (
                    <Link href="/studio" className="btn btn-primary">
                      Open Studio
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => activateProduct(item.productId, item.product.name)}
                    >
                      Select
                    </button>
                  )}
                  {isActive && (item.role === 'owner' || item.role === 'editor') ? (
                    <>
                      <Link href="/settings/brand" className="btn btn-ghost">
                        Brand
                      </Link>
                      <Link href="/settings/voice" className="btn btn-ghost">
                        Voice
                      </Link>
                      <Link href="/settings/members" className="btn btn-ghost">
                        Members
                      </Link>
                    </>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {!loading && memberships.length > 0 && !activeId ? (
        <p className="products-hint" role="status">
          Select a Product to continue in Studio.
        </p>
      ) : null}

      {createOpen ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-product-title"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={closeCreate}
            aria-label="Cancel"
            disabled={pending}
          />
          <div className="dialog-panel products-dialog">
            <h2 id="create-product-title" className="dialog-title">
              Create Product
            </h2>
            <p className="dialog-body">
              Use the brand name people know. The slug is a short id for links and settings.
            </p>
            <form className="products-form" onSubmit={onCreate}>
              <label className="products-field" htmlFor={nameId}>
                <span>Product name</span>
                <input
                  ref={nameRef}
                  id={nameId}
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  placeholder="acme"
                  value={name}
                  disabled={pending}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={Boolean(formError)}
                  aria-describedby={formError ? formErrorId : undefined}
                />
              </label>
              <label className="products-field" htmlFor={slugId}>
                <span>Slug</span>
                <input
                  id={slugId}
                  name="slug"
                  type="text"
                  required
                  minLength={2}
                  maxLength={64}
                  autoComplete="off"
                  spellCheck={false}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  title="Lowercase letters, numbers, and hyphens"
                  value={slug}
                  disabled={pending}
                  onChange={(event) => {
                    setSlugTouched(true)
                    setSlug(event.target.value.toLowerCase())
                  }}
                />
              </label>
              {formError ? (
                <p id={formErrorId} className="error" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeCreate}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? 'Creating…' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {inviteOpen ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-invite-title"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={closeInvite}
            aria-label="Cancel"
            disabled={pending}
          />
          <div className="dialog-panel products-dialog">
            <h2 id="join-invite-title" className="dialog-title">
              Join with invite
            </h2>
            <p className="dialog-body">
              Paste the invite link from a Product owner. You’ll land on the accept screen next.
            </p>
            <form className="products-form" onSubmit={onInvite}>
              <label className="products-field" htmlFor={inviteId}>
                <span>Invite link or token</span>
                <input
                  ref={inviteRef}
                  id={inviteId}
                  name="invite"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://…/invite/… or token…"
                  value={inviteToken}
                  onChange={(event) => setInviteToken(event.target.value)}
                  aria-invalid={Boolean(formError)}
                  aria-describedby={formError ? formErrorId : undefined}
                />
              </label>
              {formError ? (
                <p id={formErrorId} className="error" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={closeInvite}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
