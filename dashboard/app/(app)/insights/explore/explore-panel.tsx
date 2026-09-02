'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { IntegrationsBar, type IntegrationStatusRow } from '@/components/insights/IntegrationsBar'
import { InsightsLocalNav } from '@/components/insights/InsightsLocalNav'
import { useActiveProduct } from '@/lib/use-active-product'

type PerformanceRow = {
  final_asset_id: string
  beat_count: number
  views: number
  clicks: number
  signups: number
  revenue: number
  outcome_count: number
}

export const InsightsExplorePanel = () => {
  const {
    productId,
    productName,
    products,
    loading: productLoading,
    error: productError,
    selectProduct,
  } = useActiveProduct()
  const [performance, setPerformance] = useState<PerformanceRow[]>([])
  const [integrations, setIntegrations] = useState<IntegrationStatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [performanceUnavailable, setPerformanceUnavailable] = useState(false)

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}/insights/explore`)
    const body = (await response.json().catch(() => null)) as {
      performance?: PerformanceRow[]
      integrations?: IntegrationStatusRow[]
      performanceUnavailable?: boolean
      error?: string
    } | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load Final rollup.')
    setPerformance(body?.performance ?? [])
    setIntegrations(body?.integrations ?? [])
    setPerformanceUnavailable(Boolean(body?.performanceUnavailable))
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load Final rollup.'))
      .finally(() => setLoading(false))
  }, [load, productError, productId, productLoading])

  const maxViews = Math.max(1, ...performance.map((row) => Number(row.views) || 0))

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/insights" className="settings-crumb">
              Insights
            </Link>
            <span aria-hidden> / </span>
            Explore
          </p>
          <h1 className="settings-title">Explore</h1>
          <p className="page-lede">
            {productName ? `Final rollup for ${productName}. ` : ''}
            Bars use real views, not estimates.
          </p>
        </div>
        <div className="settings-header-actions">
          <Link href="/insights" className="btn btn-ghost">
            Open insights
          </Link>
          <Link href="/settings/outcomes" className="btn btn-primary">
            Record outcome
          </Link>
        </div>
      </header>
      <InsightsLocalNav productId={productId} products={products} onProductChange={selectProduct} />

      {!productId ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before exploring rollup.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}
      {loading ? (
        <p className="page-lede" role="status">
          Loading rollup…
        </p>
      ) : null}
      {error ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {productId && !loading ? (
        <>
          <IntegrationsBar integrations={integrations} />
          {performanceUnavailable ? (
            <div className="settings-alert is-warn" role="status">
              <p>Rollup is unavailable until the performance view is migrated.</p>
            </div>
          ) : null}
          <h2 className="section-title">Views by Final</h2>
          <ul className="settings-row-list">
            {performance.length === 0 ? (
              <li className="settings-empty-inline">
                <p>No Final rollup yet. Approve a cut, then record an outcome against its URL.</p>
              </li>
            ) : (
              performance.map((row) => {
                const views = Number(row.views) || 0
                const width = Math.max(4, Math.round((views / maxViews) * 100))
                return (
                  <li key={row.final_asset_id}>
                    <div className="insight-bar-copy">
                      <Link href={`/content/finals/${row.final_asset_id}`}>Final snapshot</Link>
                      <p className="muted">
                        {row.beat_count} beats · {views} views · {row.clicks} clicks · {row.signups}{' '}
                        signups
                      </p>
                      <div className="insight-bar" role="img" aria-label={`${views} views`}>
                        <span className="insight-bar-fill" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </>
      ) : null}
    </section>
  )
}
