'use client'

import { FormEvent, useCallback, useEffect, useId, useState } from 'react'
import {
  API_KEY_SECRET_ONCE_COPY,
  HOSTED_WEBHOOK_LOCALHOST_COPY,
  WEBHOOK_CONSENT_COPY,
  WEBHOOK_EMPTY_COPY,
  isLoopbackWebhookHost,
  webhookFailedDeliveryCopy,
  type PublicWebhook,
} from '../../../../lib/api-console-copy'
import { readApiJson } from '../../../../lib/read-api-json'
import { WEBHOOK_EVENTS } from '../../../../lib/public-api-schema'

type WebhooksResponse = {
  webhooks?: PublicWebhook[]
  hosted?: boolean
  error?: string
}

const deliveryLabel = (status: PublicWebhook['lastDeliveryStatus']): string | null => {
  if (status === 'pending') return 'pending'
  if (status === 'delivered') return 'delivered'
  if (status === 'failed') return 'failed'
  return null
}

export const ApiWebhooksSection = (input: { productId: string | null; canManage: boolean }) => {
  const urlId = useId()
  const secretId = useId()
  const [webhooks, setWebhooks] = useState<PublicWebhook[]>([])
  const [hosted, setHosted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([...WEBHOOK_EVENTS])
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState(false)

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}/webhooks`)
    const body = await readApiJson<WebhooksResponse>(response)
    if (!response.ok) throw new Error(body.error ?? 'Could not load webhooks.')
    setWebhooks(body.webhooks ?? [])
    setHosted(body.hosted === true)
  }, [])

  useEffect(() => {
    if (!input.productId) return
    setLoading(true)
    setError(null)
    void load(input.productId)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load webhooks.'))
      .finally(() => setLoading(false))
  }, [input.productId, load])

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!input.productId || pending) return
    setInlineError(null)
    if (hosted && isLoopbackWebhookHost(url)) {
      setInlineError(HOSTED_WEBHOOK_LOCALHOST_COPY)
      return
    }
    setPending(true)
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(input.productId)}/webhooks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, events }),
        },
      )
      const body = await readApiJson<{ plaintext?: string; error?: string }>(response)
      if (!response.ok) {
        const message = body.error ?? 'Could not create webhook.'
        setInlineError(message)
        return
      }
      setPlaintext(body.plaintext ?? null)
      setCopied(false)
      await load(input.productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create webhook.')
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
    setUrl('')
    setEvents([...WEBHOOK_EVENTS])
    setCopied(false)
    setInlineError(null)
  }

  const onRevoke = async (webhookId: string) => {
    if (!input.productId || pending) return
    setPending(true)
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(input.productId)}/webhooks/${encodeURIComponent(webhookId)}`,
        { method: 'POST' },
      )
      const body = await readApiJson<{ error?: string }>(response)
      if (!response.ok) throw new Error(body.error ?? 'Could not revoke webhook.')
      setRevokeId(null)
      await load(input.productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke webhook.')
    } finally {
      setPending(false)
    }
  }

  const empty = !loading && webhooks.length === 0 && !error

  return (
    <section className="api-console-section" aria-labelledby="api-webhooks-heading">
      <div className="api-console-heading-row">
        <h2 id="api-webhooks-heading" className="api-console-heading">
          Webhooks
        </h2>
        {input.canManage ? (
          <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(true)}>
            Add webhook
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {loading ? <p className="page-lede">Loading webhooks…</p> : null}
      {empty ? (
        <div className="settings-empty" role="status">
          <h3 className="settings-empty-title">{WEBHOOK_EMPTY_COPY}</h3>
          <p className="page-lede">Get job.ready and job.failed at your URL.</p>
          {input.canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              Add webhook
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="api-key-list">
          {webhooks.map((hook) => {
            const status = deliveryLabel(hook.lastDeliveryStatus)
            return (
              <li key={hook.id} className="api-key-row">
                <div>
                  <p className="api-key-name" title={hook.url} translate="no">
                    {hook.url}
                  </p>
                  <p className="api-key-meta">{hook.events.join(' · ')}</p>
                  {hook.lastDeliveryStatus === 'failed' ? (
                    <p className="api-key-meta">
                      {webhookFailedDeliveryCopy(hook.lastDeliveryError ?? '')}
                    </p>
                  ) : status ? (
                    <p className="api-key-meta">{status}</p>
                  ) : null}
                  {hook.revokedAt ? <p className="api-key-meta">Revoked</p> : null}
                </div>
                {input.canManage && !hook.revokedAt ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setRevokeId(hook.id)}
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {createOpen ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-webhook-title"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={closeCreate}
            aria-label="Close"
          />
          <div className="dialog-panel api-key-dialog">
            <h2 id="add-webhook-title" className="dialog-title">
              {plaintext ? 'Copy your signing secret' : 'Add webhook'}
            </h2>
            {plaintext ? (
              <>
                <p className="dialog-body">
                  {API_KEY_SECRET_ONCE_COPY} Closing this dialog is the last chance.
                </p>
                <label className="api-key-secret-field" htmlFor={secretId}>
                  <span>Signing secret</span>
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
                <label className="api-key-secret-field" htmlFor={urlId}>
                  <span>URL</span>
                  <input
                    id={urlId}
                    name="url"
                    type="url"
                    required
                    value={url}
                    disabled={pending}
                    onChange={(event) => {
                      setUrl(event.target.value)
                      setInlineError(null)
                    }}
                  />
                </label>
                <fieldset className="api-webhook-events">
                  <legend>Events</legend>
                  {WEBHOOK_EVENTS.map((eventName) => (
                    <label key={eventName}>
                      <input
                        type="checkbox"
                        checked={events.includes(eventName)}
                        onChange={() =>
                          setEvents((current) =>
                            current.includes(eventName)
                              ? current.filter((item) => item !== eventName)
                              : [...current, eventName],
                          )
                        }
                      />
                      {eventName}
                    </label>
                  ))}
                </fieldset>
                <p className="page-lede">{WEBHOOK_CONSENT_COPY}</p>
                {inlineError ? (
                  <p className="error" role="alert">
                    {inlineError}
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
                    Add webhook
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
          aria-labelledby="revoke-webhook-title"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={() => setRevokeId(null)}
            aria-label="Cancel"
          />
          <div className="dialog-panel api-key-dialog">
            <h2 id="revoke-webhook-title" className="dialog-title">
              Revoke this webhook?
            </h2>
            <p className="dialog-body">
              No further job.ready or job.failed posts. The row stays listed as revoked.
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
