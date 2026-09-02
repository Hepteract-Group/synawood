'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { IntegrationsBar, type IntegrationStatusRow } from '@/components/insights/IntegrationsBar'
import { InsightsLocalNav } from '@/components/insights/InsightsLocalNav'
import { useActiveProduct } from '@/lib/use-active-product'

type InsightRow = {
  id: string
  kind: string
  status: string
  title: string
  body: string
  created_at: string
}

const humanizeDigest = (message: string): string =>
  /INSIGHTS_DIGEST_TO|RESEND_API_KEY/.test(message)
    ? 'Digest preview is ready. Mail skipped until an operator sets the digest address.'
    : message

export const InsightsPanel = () => {
  const {
    productId,
    productName,
    products,
    loading: productLoading,
    error: productError,
    selectProduct,
  } = useActiveProduct()
  const [insights, setInsights] = useState<InsightRow[]>([])
  const [integrations, setIntegrations] = useState<IntegrationStatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [insightsUnavailable, setInsightsUnavailable] = useState(false)

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}/insights?status=open`)
    const body = (await response.json().catch(() => null)) as {
      insights?: InsightRow[]
      integrations?: IntegrationStatusRow[]
      insightsUnavailable?: boolean
      error?: string
    } | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load insights.')
    setInsights(body?.insights ?? [])
    setIntegrations(body?.integrations ?? [])
    setInsightsUnavailable(Boolean(body?.insightsUnavailable))
  }, [])

  useEffect(() => {
    if (productLoading) return
    if (!productId) {
      setLoading(false)
      setError(productError ?? 'Select or create a Product first.')
      return
    }
    setLoading(true)
    setError(null)
    void load(productId)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load insights.'))
      .finally(() => setLoading(false))
  }, [load, productError, productId, productLoading])

  const runAnalyses = () => {
    if (!productId) return
    setBusy('Running analyses…')
    setError(null)
    setNotice(null)
    void (async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/insights/run`, {
        method: 'POST',
      })
      const body = (await response.json().catch(() => null)) as {
        inserted?: number
        skipped?: number
        error?: string
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not run analyses.')
      const inserted = body?.inserted ?? 0
      const skipped = body?.skipped ?? 0
      setNotice(
        inserted === 0 && skipped === 0
          ? 'No new patterns. Record outcomes, then run again.'
          : `Saved ${inserted} insight${inserted === 1 ? '' : 's'}${skipped ? `; skipped ${skipped} already open` : ''}.`,
      )
      await load(productId)
    })()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not run analyses.'))
      .finally(() => setBusy(null))
  }

  const act = (insightId: string, action: 'apply' | 'dismiss' | 'snooze') => {
    if (!productId) return
    const label =
      action === 'apply' ? 'Applying insight…' : action === 'dismiss' ? 'Dismissing…' : 'Snoozing…'
    setBusy(label)
    setError(null)
    setNotice(null)
    void (async () => {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/insights/${encodeURIComponent(insightId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      )
      const body = (await response.json().catch(() => null)) as {
        error?: string
        wroteLocalFile?: boolean
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not update insight.')
      if (action === 'apply') {
        setNotice(
          body?.wroteLocalFile
            ? 'Priors written to the local overlay. Studio reads them on the next session that loads priors.'
            : 'Insight marked applied. Hosted cannot write the git overlay; the merged priors are stored on this row.',
        )
      } else if (action === 'dismiss') {
        setNotice('Insight dismissed.')
      } else {
        setNotice('Insight snoozed for 7 days.')
      }
      await load(productId)
    })()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not update insight.'))
      .finally(() => setBusy(null))
  }

  const sendDigest = () => {
    if (!productId) return
    setBusy('Building digest…')
    setError(null)
    setNotice(null)
    void (async () => {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/insights/digest`,
        { method: 'POST' },
      )
      const body = (await response.json().catch(() => null)) as {
        sent?: boolean
        skipped?: boolean
        reason?: string
        preview?: { subject?: string }
        error?: string
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not build digest.')
      if (body?.sent) {
        setNotice(`Digest mailed (${body.preview?.subject ?? 'open insights'}).`)
        return
      }
      setNotice(humanizeDigest(body?.reason ?? 'Digest preview ready. Mail skipped.'))
    })()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not build digest.'))
      .finally(() => setBusy(null))
  }

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">Insights</p>
          <h1 className="settings-title">Insights</h1>
          <p className="page-lede">
            {productName ? `Proposals for ${productName}. ` : ''}
            Apply writes local priors. Nothing auto-applies.
          </p>
        </div>
        <div className="settings-header-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!productId || Boolean(busy)}
            onClick={sendDigest}
          >
            Email digest
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!productId || Boolean(busy)}
            onClick={runAnalyses}
          >
            Run analyses
          </button>
        </div>
      </header>
      <InsightsLocalNav
        productId={productId}
        products={products}
        onProductChange={(id) => {
          setNotice(null)
          selectProduct(id)
        }}
      />

      {!productId ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before reviewing insights.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}
      {loading ? (
        <p className="page-lede" role="status">
          Loading insights…
        </p>
      ) : null}
      {busy ? (
        <div className="settings-alert" role="status">
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

      {productId && !loading ? (
        <>
          <IntegrationsBar integrations={integrations} />
          {insightsUnavailable ? (
            <div className="settings-alert is-warn" role="status">
              <p>Insights table is unavailable until the local migration is applied.</p>
            </div>
          ) : null}
          <h2 className="section-title">Open</h2>
          <ul className="settings-row-list">
            {insights.length === 0 ? (
              <li className="settings-empty-inline">
                <p>No open insights. Record outcomes, then run analyses.</p>
              </li>
            ) : (
              insights.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.title}</strong>
                    <p className="muted">{row.body}</p>
                  </div>
                  <div className="insights-row-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={Boolean(busy)}
                      onClick={() => act(row.id, 'apply')}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={Boolean(busy)}
                      onClick={() => act(row.id, 'snooze')}
                    >
                      Snooze
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={Boolean(busy)}
                      onClick={() => act(row.id, 'dismiss')}
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      ) : null}
    </section>
  )
}
