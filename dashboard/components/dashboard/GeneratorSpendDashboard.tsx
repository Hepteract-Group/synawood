'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { readApiJson } from '@/lib/read-api-json'
import { resolveClientProductId } from '@/lib/resolve-client-product-id'
import { SPEND_PIE_COLORS, SpendPieChart } from './SpendPieChart'
import { SpendScopeSelect } from './SpendScopeSelect'

type ProductOption = { id: string; slug: string; name: string }

type CostsDashboard = {
  scope: 'all' | string
  products: ProductOption[]
  spent: { monthGbp: number; weekGbp: number; totalGbp: number }
  budgets: {
    monthlyGeneratorCap: number
    weeklySoftCap: number
    perProjectWarnGbp: number
  }
  remainingMonthlyGbp: number | null
  byProduct: Array<{
    productId: string
    name: string
    slug: string
    monthGbp: number
    totalGbp: number
  }>
  byProject: Array<{
    projectId: string | null
    label: string
    gbp: number
  }>
  recent: Array<{
    id: string
    product_id: string
    role: string
    model_id: string | null
    estimated_gbp: number | null
    actual_gbp: number | null
    project_id: string | null
    created_at: string
  }>
}

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fmt = (n: number) => gbp.format(n)

const formatWhen = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const RECENT_PAGE_SIZE = 8

export const GeneratorSpendDashboard = () => {
  const [scope, setScope] = useState<string>('all')
  const [hydrated, setHydrated] = useState(false)
  const [data, setData] = useState<CostsDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentPage, setRecentPage] = useState(0)

  useEffect(() => {
    const active = resolveClientProductId()
    setScope(active ?? 'all')
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      setRecentPage(0)
      try {
        const response = await fetch(`/api/studio/costs?productId=${encodeURIComponent(scope)}`)
        const body = await readApiJson<CostsDashboard & { error?: string }>(response)
        if (!response.ok) {
          throw new Error(body.error ?? 'Failed to load spend')
        }
        if (!cancelled) setData(body)
      } catch (err) {
        if (!cancelled) {
          setData(null)
          setError(err instanceof Error ? err.message : 'Failed to load spend')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hydrated, scope])

  const pieSlices = useMemo(() => {
    if (!data) return []
    const top = data.byProject.slice(0, 7)
    const rest = data.byProject.slice(7)
    const restTotal = rest.reduce((sum, row) => sum + row.gbp, 0)
    const slices = top.map((row, index) => ({
      key: row.projectId ?? `unassigned-${index}`,
      label: row.label,
      value: row.gbp,
      color: SPEND_PIE_COLORS[index % SPEND_PIE_COLORS.length],
    }))
    if (restTotal > 0) {
      slices.push({
        key: 'other',
        label: 'Other projects',
        value: restTotal,
        color: SPEND_PIE_COLORS[slices.length % SPEND_PIE_COLORS.length],
      })
    }
    return slices
  }, [data])

  if (error === 'Unauthorized') {
    return (
      <section className="spend-dashboard">
        <p className="error">
          <Link href="/login?next=/home">Sign in</Link> to view generator spend.
        </p>
      </section>
    )
  }

  if (error === 'Create or join a Product first.') {
    return (
      <section className="spend-dashboard">
        <div className="spend-empty">
          <h2 className="spend-section-title">Generator spend</h2>
          <p className="page-lede">Create a Product to start tracking generator cost.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="spend-dashboard">
        <p className="error">{error}</p>
      </section>
    )
  }

  if (loading && !data) {
    return (
      <section className="spend-dashboard">
        <p className="page-lede" role="status" aria-live="polite">
          Loading generator spend…
        </p>
      </section>
    )
  }

  if (!data) return null

  const overWeek = data.spent.weekGbp >= data.budgets.weeklySoftCap
  const productNameById = new Map(data.products.map((p) => [p.id, p.name]))
  const maxProductMonth = Math.max(...data.byProduct.map((row) => row.monthGbp), 0.01)
  const scopeOptions = [
    {
      value: 'all',
      label: 'All Products',
      mark: 'A',
      meta: `${data.products.length} in view`,
    },
    ...data.products.map((product) => ({
      value: product.id,
      label: product.name,
      mark: (product.name.trim().charAt(0) || '?').toUpperCase(),
      meta: product.slug,
    })),
  ]

  return (
    <section className="spend-dashboard mos-enter" aria-labelledby="spend-heading">
      <div className="spend-dashboard-header">
        <div>
          <h2 id="spend-heading" className="spend-section-title">
            Generator spend
          </h2>
          <p className="spend-header-note">
            Caps and Studio project breakdown for the last 31 days.
          </p>
        </div>
        <SpendScopeSelect
          label="Product"
          value={scope}
          options={scopeOptions}
          onChange={setScope}
        />
      </div>

      <div className="spend-total-hero">
        <div>
          <p className="spend-meter-label">Total generator cost</p>
          <p className="spend-total-value tabular-nums">{fmt(data.spent.totalGbp)}</p>
          <p className="spend-meter-note">
            All time · {scope === 'all' ? 'every Product' : 'this Product'}
          </p>
        </div>
        <div className="spend-total-side">
          <p className="spend-meter-label">This month</p>
          <p className="spend-total-side-value tabular-nums">{fmt(data.spent.monthGbp)}</p>
        </div>
      </div>

      {scope !== 'all' && data.remainingMonthlyGbp != null ? (
        <div className="spend-dashboard-meters mos-stagger">
          <article>
            <span className="spend-meter-label">This month</span>
            <p className="spend-meter-value">
              <strong className="tabular-nums">{fmt(data.spent.monthGbp)}</strong>
              <span className="tabular-nums"> / {fmt(data.budgets.monthlyGeneratorCap)}</span>
            </p>
            <p className="spend-meter-note tabular-nums">
              {fmt(data.remainingMonthlyGbp)} remaining
            </p>
          </article>
          <article className={overWeek ? 'spend-warn' : undefined}>
            <span className="spend-meter-label">This week</span>
            <p className="spend-meter-value">
              <strong className="tabular-nums">{fmt(data.spent.weekGbp)}</strong>
              <span className="tabular-nums"> / {fmt(data.budgets.weeklySoftCap)}</span>
            </p>
            <p className="spend-meter-note">
              {overWeek ? 'Soft cap reached' : 'Soft weekly guide'}
            </p>
          </article>
          <article>
            <span className="spend-meter-label">Per-project warn</span>
            <p className="spend-meter-value">
              <strong className="tabular-nums">{fmt(data.budgets.perProjectWarnGbp)}</strong>
            </p>
            <p className="spend-meter-note">Studio asks before going past this</p>
          </article>
        </div>
      ) : (
        <div className="spend-dashboard-meters mos-stagger">
          <article>
            <span className="spend-meter-label">This month</span>
            <p className="spend-meter-value">
              <strong className="tabular-nums">{fmt(data.spent.monthGbp)}</strong>
            </p>
            <p className="spend-meter-note">Across selected Products</p>
          </article>
          <article>
            <span className="spend-meter-label">This week</span>
            <p className="spend-meter-value">
              <strong className="tabular-nums">{fmt(data.spent.weekGbp)}</strong>
            </p>
            <p className="spend-meter-note">Last 7 days</p>
          </article>
          <article>
            <span className="spend-meter-label">Products</span>
            <p className="spend-meter-value">
              <strong className="tabular-nums">{data.byProduct.length}</strong>
            </p>
            <p className="spend-meter-note">In this view</p>
          </article>
        </div>
      )}

      <div className="spend-breakdown-grid mos-stagger">
        <div className="spend-breakdown-panel">
          <h3 className="spend-recent-title">By Product</h3>
          {data.byProduct.length === 0 ? (
            <p className="page-lede">No Product spend yet.</p>
          ) : (
            <ul className="spend-product-bars">
              {data.byProduct.map((row) => (
                <li key={row.productId} className="spend-product-bar-row">
                  <div className="spend-product-bar-head">
                    <strong>{row.name}</strong>
                    <span className="tabular-nums">{fmt(row.monthGbp)}</span>
                  </div>
                  <div
                    className="spend-product-bar-track"
                    role="img"
                    aria-label={`${row.name}: ${fmt(row.monthGbp)} this month`}
                  >
                    <span
                      className="spend-product-bar-fill"
                      style={{ width: `${Math.max(4, (row.monthGbp / maxProductMonth) * 100)}%` }}
                    />
                  </div>
                  <p className="spend-product-bar-meta tabular-nums">Total {fmt(row.totalGbp)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="spend-breakdown-panel">
          <h3 className="spend-recent-title">By Studio project</h3>
          <SpendPieChart slices={pieSlices} totalLabel={fmt(data.spent.monthGbp)} />
        </div>
      </div>

      <div className="spend-dashboard-recent">
        <div className="spend-recent-head">
          <h3 className="spend-recent-title">Recent costs</h3>
          {data.recent.length > 0 ? (
            <p className="spend-recent-count tabular-nums">
              {data.recent.length} event{data.recent.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
        {data.recent.length === 0 ? (
          <p className="page-lede">No generator spend yet — mock runs show {fmt(0)}.</p>
        ) : (
          <>
            <div className="spend-table-wrap mos-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    {scope === 'all' ? <th>Product</th> : null}
                    <th>Role</th>
                    <th>Model</th>
                    <th>Est.</th>
                    <th>Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent
                    .slice(
                      recentPage * RECENT_PAGE_SIZE,
                      recentPage * RECENT_PAGE_SIZE + RECENT_PAGE_SIZE,
                    )
                    .map((row) => (
                      <tr key={row.id}>
                        <td className="mono">{formatWhen(row.created_at)}</td>
                        {scope === 'all' ? (
                          <td>{productNameById.get(row.product_id) ?? row.product_id}</td>
                        ) : null}
                        <td>{row.role}</td>
                        <td className="mono">{row.model_id ?? '—'}</td>
                        <td className="tabular-nums">
                          {row.estimated_gbp != null ? fmt(Number(row.estimated_gbp)) : '—'}
                        </td>
                        <td className="tabular-nums">
                          {row.actual_gbp != null ? fmt(Number(row.actual_gbp)) : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {data.recent.length > RECENT_PAGE_SIZE ? (
              <div className="spend-pager">
                <button
                  type="button"
                  className="btn btn-ghost spend-pager-btn"
                  disabled={recentPage === 0}
                  onClick={() => setRecentPage((page) => Math.max(0, page - 1))}
                >
                  Previous
                </button>
                <p className="spend-pager-status tabular-nums" aria-live="polite">
                  Page {recentPage + 1} of{' '}
                  {Math.max(1, Math.ceil(data.recent.length / RECENT_PAGE_SIZE))}
                </p>
                <button
                  type="button"
                  className="btn btn-ghost spend-pager-btn"
                  disabled={(recentPage + 1) * RECENT_PAGE_SIZE >= data.recent.length}
                  onClick={() =>
                    setRecentPage((page) =>
                      (page + 1) * RECENT_PAGE_SIZE >= data.recent.length ? page : page + 1,
                    )
                  }
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
