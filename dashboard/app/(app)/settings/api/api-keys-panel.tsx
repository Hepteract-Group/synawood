'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useId, useState } from 'react'
import {
  API_KEY_EMPTY_COPY,
  API_KEY_INTRO,
  API_KEY_OWNER_ONLY_COPY,
  API_KEY_SECRET_ONCE_COPY,
  formatApiKeyLastUsed,
  type PublicApiKey,
} from '../../../../lib/api-console-copy'
import { readApiJson } from '../../../../lib/read-api-json'
import { useActiveProduct } from '../../../../lib/use-active-product'
import { SettingsLocalNav } from '../settings-local-nav'
import { ApiWebhooksSection } from './api-webhooks-section'

type KeysResponse = {
  keys?: PublicApiKey[]
  canManage?: boolean
  error?: string
}

export const ApiKeysPanel = () => {
  const nameId = useId()
  const secretId = useId()
  const { productId, loading: productLoading } = useActiveProduct()
  const [keys, setKeys] = useState<PublicApiKey[]>([])
  const [canManage, setCanManage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState(false)

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}/api-keys`)
    const body = await readApiJson<KeysResponse>(response)
    if (!response.ok) throw new Error(body.error ?? 'Could not load API keys.')
    setKeys(body.keys ?? [])
    setCanManage(body.canManage === true)
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load API keys.'))
      .finally(() => setLoading(false))
  }, [load, productId, productLoading])

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!productId || pending) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const body = await readApiJson<{ key?: PublicApiKey; plaintext?: string; error?: string }>(
        response,
      )
      if (!response.ok) throw new Error(body.error ?? 'Could not create API key.')
      setPlaintext(body.plaintext ?? null)
      setCopied(false)
      await load(productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create API key.')
    } finally {
      setPending(false)
    }
  }

  const onCopy = async () => {
    if (!plaintext) return
    await navigator.clipboard.writeText(plaintext)
    setCopied(true)
  }

  const closeCreate = () => {
    setCreateOpen(false)
    setPlaintext(null)
    setName('')
    setCopied(false)
  }

  const onRevoke = async (keyId: string) => {
    if (!productId || pending) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/api-keys/${encodeURIComponent(keyId)}`,
        { method: 'POST' },
      )
      const body = await readApiJson<{ error?: string }>(response)
      if (!response.ok) throw new Error(body.error ?? 'Could not revoke API key.')
      setRevokeId(null)
      await load(productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke API key.')
    } finally {
      setPending(false)
    }
  }

  const noProduct = !productId && !productLoading
  const empty = !loading && keys.length === 0 && !error

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/settings" className="settings-crumb">
              Settings
            </Link>
            <span aria-hidden> / </span>
            API
          </p>
          <h1 className="settings-title">API</h1>
          <p className="page-lede">{API_KEY_INTRO}</p>
        </div>
        <div className="settings-header-actions">
          {canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              Create key
            </button>
          ) : null}
          <Link href="/settings" className="btn btn-ghost">
            All settings
          </Link>
        </div>
      </header>
      <SettingsLocalNav />

      {noProduct || error === 'Select or create a Product first.' ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before managing API keys.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}

      {error === 'Unauthorized' ? (
        <div className="settings-alert is-error" role="alert">
          <p>
            <Link href="/login?next=/settings/api">Sign in</Link> to manage API keys.
          </p>
        </div>
      ) : error && error !== 'Select or create a Product first.' ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {!canManage && !loading && productId ? (
        <div className="settings-alert is-warn" role="status">
          <p>{API_KEY_OWNER_ONLY_COPY}</p>
        </div>
      ) : null}

      <section className="api-console-section" aria-labelledby="api-keys-heading">
        <h2 id="api-keys-heading" className="api-console-heading">
          Keys
        </h2>
        {loading ? <p className="page-lede">Loading keys…</p> : null}
        {empty ? (
          <div className="settings-empty" role="status">
            <h3 className="settings-empty-title">{API_KEY_EMPTY_COPY}</h3>
            <p className="page-lede">Create a key to call /api/v1 from scripts.</p>
            {canManage ? (
              <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                Create key
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="api-key-list">
            {keys.map((key) => (
              <li key={key.id} className="api-key-row">
                <div>
                  <p className="api-key-name">{key.name}</p>
                  <p className="api-key-prefix" translate="no">
                    {key.keyPrefix}…
                  </p>
                  <p className="api-key-meta">
                    Last used {formatApiKeyLastUsed(key.lastUsedAt)}
                    {key.revokedAt ? (
                      <>
                        <span aria-hidden> · </span>
                        <span>Revoked</span>
                      </>
                    ) : null}
                  </p>
                </div>
                {canManage && !key.revokedAt ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setRevokeId(key.id)}
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ApiWebhooksSection productId={productId} canManage={canManage} />

      {createOpen ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-key-title"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={closeCreate}
            aria-label="Close"
          />
          <div className="dialog-panel api-key-dialog">
            <h2 id="create-key-title" className="dialog-title">
              {plaintext ? 'Copy your API key' : 'Create key'}
            </h2>
            {plaintext ? (
              <>
                <p className="dialog-body">
                  {API_KEY_SECRET_ONCE_COPY} Closing this dialog is the last chance.
                </p>
                <label className="api-key-secret-field" htmlFor={secretId}>
                  <span>Secret</span>
                  <input id={secretId} readOnly value={plaintext} />
                </label>
                <div className="dialog-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => void onCopy()}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={closeCreate}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={(event) => void onCreate(event)}>
                <label className="api-key-secret-field" htmlFor={nameId}>
                  <span>Name</span>
                  <input
                    id={nameId}
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    value={name}
                    disabled={pending}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
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
                    Create key
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {revokeId ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-key-title"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={() => setRevokeId(null)}
            aria-label="Cancel"
          />
          <div className="dialog-panel api-key-dialog">
            <h2 id="revoke-key-title" className="dialog-title">
              Revoke this key?
            </h2>
            <p className="dialog-body">
              Scripts using it will get 401. The row stays listed as revoked.
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setRevokeId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={pending}
                onClick={() => void onRevoke(revokeId)}
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
