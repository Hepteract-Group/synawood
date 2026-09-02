'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useId, useState } from 'react'
import {
  DNA_FIELD_KEYS,
  DNA_FIELD_LABELS,
  dnaFieldPreview,
  type BrandDna,
} from '@synawood/creative/brand/dna'
import type { CatalogItem, ProductCatalog } from '@synawood/creative/brand/catalog'
import { ConfirmDialog } from '@/components/studio/ConfirmDialog'
import { brandDnaLede } from '../../../../lib/product-scope-copy'
import { useActiveProduct } from '../../../../lib/use-active-product'
import { SettingsLocalNav } from '../settings-local-nav'
import { BrandDnaForm, type DnaSection } from './brand-dna-form'

type DnaResponse = {
  dna?: BrandDna
  source?: string
  draft?: BrandDna | null
  draftUrl?: string | null
  error?: string
}

type CatalogResponse = {
  catalog?: ProductCatalog
  error?: string
}

type BookResponse = {
  markdown?: string | null
  path?: string | null
  error?: string
}

const emptyItem = (): CatalogItem => ({
  id: '',
  name: '',
  summary: '',
  claimBounds: [],
  forbiddenClaims: [],
})

const previewOrEmpty = (value: string): string => (value.trim() ? value : '(empty)')

export const BrandPanel = () => {
  const ingestId = useId()
  const { productId, productName, loading: productLoading } = useActiveProduct()
  const [dna, setDna] = useState<BrandDna | null>(null)
  const [draft, setDraft] = useState<BrandDna | null>(null)
  const [draftUrl, setDraftUrl] = useState<string | null>(null)
  const [applyFields, setApplyFields] = useState<string[]>(['tagline', 'offer'])
  const [catalog, setCatalog] = useState<ProductCatalog | null>(null)
  const [item, setItem] = useState<CatalogItem>(emptyItem())
  const [ingestUrl, setIngestUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dnaSection, setDnaSection] = useState<DnaSection>('overview')
  const [bookMarkdown, setBookMarkdown] = useState<string | null>(null)
  const [bookPath, setBookPath] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const load = useCallback(async (id: string) => {
    const [dnaRes, catRes, bookRes] = await Promise.all([
      fetch(`/api/products/${encodeURIComponent(id)}/brand/dna`),
      fetch(`/api/products/${encodeURIComponent(id)}/catalog`),
      fetch(`/api/products/${encodeURIComponent(id)}/brand/book`),
    ])
    const dnaBody = (await dnaRes.json().catch(() => null)) as DnaResponse | null
    const catBody = (await catRes.json().catch(() => null)) as CatalogResponse | null
    const bookBody = (await bookRes.json().catch(() => null)) as BookResponse | null
    if (!dnaRes.ok) throw new Error(dnaBody?.error ?? 'Could not load Brand DNA.')
    if (!catRes.ok) throw new Error(catBody?.error ?? 'Could not load Catalog.')
    setDna(dnaBody?.dna ?? null)
    setDraft(dnaBody?.draft ?? null)
    setDraftUrl(dnaBody?.draftUrl ?? null)
    setIngestUrl((current) => current.trim() || dnaBody?.dna?.business.url || '')
    setCatalog(catBody?.catalog ?? null)
    setBookMarkdown(bookRes.ok ? (bookBody?.markdown ?? null) : null)
    setBookPath(bookRes.ok ? (bookBody?.path ?? null) : null)
  }, [])

  useEffect(() => {
    if (productLoading) return
    if (!productId) {
      setLoading(false)
      setError('Select or create a Product first.')
      return
    }
    setLoading(true)
    setError(null)
    void load(productId)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load brand.'))
      .finally(() => setLoading(false))
  }, [load, productId, productLoading])

  const run = async (label: string, work: () => Promise<void>) => {
    if (!productId) return
    setError(null)
    setNotice(null)
    setBusy(label)
    try {
      await work()
      await load(productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  const saveDna = (event: FormEvent) => {
    event.preventDefault()
    if (!dna || !productId) return
    void run('Saving brand copy…', async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/brand/dna`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dna),
      })
      const body = (await response.json().catch(() => null)) as DnaResponse | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not save brand copy.')
      setNotice('Brand copy saved.')
    })
  }

  const ingest = (event: FormEvent) => {
    event.preventDefault()
    if (!productId) return
    void run('Fetching page…', async () => {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/brand/dna/ingest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: ingestUrl }),
        },
      )
      const body = (await response.json().catch(() => null)) as DnaResponse | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not ingest that URL.')
      setNotice('Draft ready. Select fields below, then Apply.')
    })
  }

  const applyDraft = () => {
    if (!productId) return
    void run('Applying draft…', async () => {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/brand/dna?action=apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: applyFields }),
        },
      )
      const body = (await response.json().catch(() => null)) as DnaResponse | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not apply draft.')
      setNotice('Selected unlocked fields applied. Draft cleared.')
    })
  }

  const discardDraft = () => {
    if (!productId) return
    void run('Discarding draft…', async () => {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/brand/dna?action=discard`,
        { method: 'POST' },
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as DnaResponse | null
        throw new Error(body?.error ?? 'Could not discard draft.')
      }
      setNotice('Ingest draft discarded.')
    })
  }

  const resetDna = () => {
    if (!productId) return
    void run('Resetting brand copy…', async () => {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/brand/dna?action=reset`,
        { method: 'POST' },
      )
      const body = (await response.json().catch(() => null)) as DnaResponse | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not reset brand copy.')
      setNotice('Brand copy reset to the product kit file (or empty if none).')
    })
  }

  const saveItem = (event: FormEvent) => {
    event.preventDefault()
    if (!productId) return
    void run('Saving catalog item…', async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          claimBounds: item.claimBounds.filter(Boolean),
          forbiddenClaims: item.forbiddenClaims.filter(Boolean),
        }),
      })
      const body = (await response.json().catch(() => null)) as CatalogResponse | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not save catalog item.')
      setItem(emptyItem())
      setNotice('Catalog item saved. This is not the Media bin.')
    })
  }

  const deleteItem = (itemId: string) => {
    if (!productId) return
    void run('Removing catalog item…', async () => {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/catalog/items/${encodeURIComponent(itemId)}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as CatalogResponse | null
        throw new Error(body?.error ?? 'Could not delete catalog item.')
      }
    })
  }

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/settings" className="settings-crumb">
              Settings
            </Link>
            <span aria-hidden> / </span>
            Brand
          </p>
          <h1 className="settings-title">
            {productName ? `Brand DNA and Catalog — ${productName}` : 'Brand DNA and Catalog'}
          </h1>
          <p className="page-lede">{brandDnaLede(productName)}</p>
        </div>
        <div className="settings-header-actions">
          <Link href="/settings" className="btn btn-ghost">
            All settings
          </Link>
          <Link href="/products" className="btn btn-primary">
            Products
          </Link>
        </div>
      </header>
      <SettingsLocalNav />

      {!productLoading && !productId ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before editing Brand DNA.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}

      {loading ? (
        <p className="page-lede" role="status" aria-live="polite">
          Loading brand copy…
        </p>
      ) : null}

      {busy ? (
        <div className="settings-alert" role="status" aria-live="polite">
          <p>{busy}</p>
        </div>
      ) : null}
      {error ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {notice ? (
        <div className="settings-alert is-ok" role="status">
          <p>{notice}</p>
        </div>
      ) : null}

      {draft && draftUrl ? (
        <div className="settings-alert" role="status">
          <p>
            Draft from {draftUrl}. Protected fields will not change. This banner stays until you
            Apply or Discard.
          </p>
          <div className="brand-dna-apply">
            {DNA_FIELD_KEYS.map((key) => {
              const live = previewOrEmpty(dna ? dnaFieldPreview(dna, key) : '')
              const proposed = previewOrEmpty(dnaFieldPreview(draft, key))
              const changed = live !== proposed
              return (
                <label
                  key={key}
                  className={changed ? 'brand-dna-diff is-changed' : 'brand-dna-diff'}
                >
                  <input
                    type="checkbox"
                    checked={applyFields.includes(key)}
                    disabled={dna?.lockedFields.includes(key)}
                    onChange={(event) => {
                      setApplyFields((current) =>
                        event.target.checked
                          ? [...current, key]
                          : current.filter((itemKey) => itemKey !== key),
                      )
                    }}
                  />
                  <span>
                    <strong>{DNA_FIELD_LABELS[key]}</strong>
                    {dna?.lockedFields.includes(key) ? ' (protected)' : ''}
                    {changed ? '' : ' (unchanged)'}
                    <br />
                    <span className="muted">Live: {live}</span>
                    <br />
                    <span>Draft: {proposed}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <div className="settings-header-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(busy)}
              onClick={applyDraft}
            >
              Apply selected
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={Boolean(busy)}
              onClick={discardDraft}
            >
              Discard draft
            </button>
          </div>
        </div>
      ) : null}

      {productId && dna && !loading ? (
        <>
          <BrandDnaForm
            dna={dna}
            onChange={setDna}
            section={dnaSection}
            onSection={setDnaSection}
            busy={Boolean(busy)}
            onSave={saveDna}
            onReset={() => setConfirmReset(true)}
          />

          <h2 className="section-title">Fetch copy from a page</h2>
          <form onSubmit={ingest} className="auth-form members-invite-form">
            <label htmlFor={ingestId}>
              Public website
              <input
                id={ingestId}
                type="url"
                value={ingestUrl}
                onChange={(event) => setIngestUrl(event.target.value)}
                placeholder="Paste a public homepage"
              />
            </label>
            <button type="submit" className="auth-submit" disabled={Boolean(busy)}>
              Fetch draft
            </button>
          </form>

          <h2 className="section-title">Brand Book</h2>
          {bookMarkdown ? (
            <details className="brand-book-preview">
              <summary>{bookPath ?? 'product-marketing.md'}</summary>
              <pre className="settings-code-block">{bookMarkdown}</pre>
            </details>
          ) : (
            <p className="muted">No product-marketing.md for this Product.</p>
          )}

          <h2 className="section-title">Product Catalog</h2>
          <p className="page-lede">
            Offer SKUs and claim bounds. Campaign pickers read this list, not uploaded footage.
            Deleting an item does not rewrite historical campaign snapshots.
          </p>
          <ul className="settings-row-list">
            {(catalog?.items ?? []).length === 0 ? (
              <li className="settings-empty-inline">
                <p>No catalog items yet. Add an offer SKU in the form below.</p>
                <p className="page-lede">Campaign pickers read this list, not uploaded footage.</p>
              </li>
            ) : (
              (catalog?.items ?? []).map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.name}</strong>
                    <p className="muted">{row.id}</p>
                    {row.summary ? <p className="muted">{row.summary}</p> : null}
                    {row.claimBounds.length > 0 ? (
                      <p className="muted">Claims: {row.claimBounds.join('; ')}</p>
                    ) : null}
                    {row.forbiddenClaims.length > 0 ? (
                      <p className="muted">Forbidden: {row.forbiddenClaims.join('; ')}</p>
                    ) : null}
                  </div>
                  <div className="settings-header-actions">
                    <button type="button" className="text-button" onClick={() => setItem(row)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => deleteItem(row.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
          <form onSubmit={saveItem} className="auth-form members-invite-form">
            <label>
              Item id
              <input
                required
                value={item.id}
                onChange={(event) => setItem({ ...item, id: event.target.value })}
              />
            </label>
            <label>
              Name
              <input
                required
                value={item.name}
                onChange={(event) => setItem({ ...item, name: event.target.value })}
              />
            </label>
            <label>
              Summary
              <textarea
                rows={2}
                value={item.summary}
                onChange={(event) => setItem({ ...item, summary: event.target.value })}
              />
            </label>
            <label>
              Claim bounds (one per line)
              <textarea
                rows={3}
                value={item.claimBounds.join('\n')}
                onChange={(event) =>
                  setItem({
                    ...item,
                    claimBounds: event.target.value
                      .split('\n')
                      .map((row) => row.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Forbidden claims (one per line)
              <textarea
                rows={3}
                value={item.forbiddenClaims.join('\n')}
                onChange={(event) =>
                  setItem({
                    ...item,
                    forbiddenClaims: event.target.value
                      .split('\n')
                      .map((row) => row.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <button type="submit" className="auth-submit" disabled={Boolean(busy)}>
              Add or update item
            </button>
          </form>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmReset}
        title="Reset brand copy?"
        body="This replaces the saved Brand DNA (product copy) with the product kit file, or empty defaults. The website-import draft is discarded. Protected fields on the kit file stay protected."
        confirmLabel="Reset"
        cancelLabel="Keep current"
        danger
        onConfirm={() => {
          setConfirmReset(false)
          resetDna()
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </section>
  )
}
