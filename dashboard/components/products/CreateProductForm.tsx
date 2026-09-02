'use client'

import { FormEvent, useEffect, useId, useState, type ReactNode } from 'react'
import { rememberActiveProductId } from '../../lib/active-product-cookie'
import { slugifyProductName } from '../../lib/product-slug'

export type CreatedProduct = {
  id: string
  name: string
  slug: string
}

type CreateProductFormProps = {
  submitLabel?: string
  pendingLabel?: string
  nameLabel?: string
  slugLabel?: string
  namePlaceholder?: string
  slugHint?: string
  failMessage?: string
  className?: string
  submitClassName?: string
  children?: ReactNode
  onCreated: (product: CreatedProduct) => void | Promise<void>
}

export const CreateProductForm = ({
  submitLabel = 'Create organization',
  pendingLabel = 'Creating…',
  nameLabel = 'Organization name',
  slugLabel = 'URL',
  namePlaceholder = 'Acme',
  slugHint = 'Lowercase letters, numbers, and hyphens.',
  failMessage = 'Could not create organization.',
  className = 'auth-form',
  submitClassName = 'auth-submit',
  children,
  onCreated,
}: CreateProductFormProps) => {
  const nameId = useId()
  const slugId = useId()
  const errorId = useId()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!slugTouched) setSlug(slugifyProductName(name))
  }, [name, slugTouched])

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      })
      const body = (await response.json().catch(() => null)) as {
        product?: CreatedProduct
        error?: string
      } | null
      if (!response.ok || !body?.product) {
        throw new Error(body?.error ?? failMessage)
      }
      rememberActiveProductId(body.product.id)
      await onCreated(body.product)
      setPending(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPending(false)
    }
  }

  return (
    <form onSubmit={(event) => void onCreate(event)} className={className} aria-busy={pending}>
      <label htmlFor={nameId}>
        {nameLabel}
        <input
          id={nameId}
          required
          minLength={2}
          maxLength={80}
          placeholder={namePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      </label>
      <label htmlFor={slugId}>
        {slugLabel}
        <input
          id={slugId}
          required
          minLength={2}
          maxLength={64}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          title="Lowercase letters, numbers, and hyphens"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true)
            setSlug(event.target.value.toLowerCase())
          }}
          aria-describedby={slugHint ? `${slugId}-hint` : undefined}
        />
        {slugHint ? (
          <span id={`${slugId}-hint`} className="auth-field-hint">
            {slugHint}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className={submitClassName} disabled={pending} aria-busy={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}
