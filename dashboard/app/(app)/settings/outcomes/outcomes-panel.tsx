'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useId, useState } from 'react'
import { readActiveProductIdFromDocument } from '../../../../lib/active-product-cookie'
import { SettingsLocalNav } from '../settings-local-nav'

type OutcomeRow = {
  id: string
  metric: string
  value: number
  occurred_at: string
  final_asset_id: string | null
  source: string
}

type PerformanceRow = {
  final_asset_id: string
  beat_count: number
  views: number
  clicks: number
  signups: number
  revenue: number
  outcome_count: number
}

type IntegrationRow = {
  id?: string
  provider: string
  status: string
  last_pull_at?: string | null
  last_pull_reason?: string | null
  last_pull_row_count?: number
  auth_kind?: string
}

const TOKEN_PROVIDERS = ['tiktok', 'meta', 'youtube', 'linkedin', 'shopify', 'stripe'] as const

const METRIC_LABEL: Record<string, string> = {
  views: 'Views',
  clicks: 'Clicks',
  signups: 'Signups',
  revenue: 'Revenue',
}

const humanizeOutcomesError = (message: string): string =>
  /PERFORMANCE_TOKEN_KEY/.test(message)
    ? 'Token paste is locked until an operator sets the encryption key.'
    : message

export const OutcomesPanel = () => {
  const metricId = useId()
  const valueId = useId()
  const urlId = useId()
  const finalId = useId()
  const tokenProviderId = useId()
  const tokenId = useId()
  const [productId, setProductId] = useState<string | null>(null)
  const [metric, setMetric] = useState<'views' | 'clicks' | 'signups' | 'revenue'>('views')
  const [value, setValue] = useState('0')
  const [externalUrl, setExternalUrl] = useState('')
  const [finalAssetId, setFinalAssetId] = useState('')
  const [tokenProvider, setTokenProvider] = useState<(typeof TOKEN_PROVIDERS)[number]>('tiktok')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([])
  const [performance, setPerformance] = useState<PerformanceRow[]>([])
  const [performanceUnavailable, setPerformanceUnavailable] = useState(false)
  const [unattributedCount, setUnattributedCount] = useState(0)
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([])
  const [oauthConfigured, setOauthConfigured] = useState<Record<string, boolean>>({})
  const [shopDomain, setShopDomain] = useState('')

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}/outcomes`)
    const body = (await response.json().catch(() => null)) as {
      outcomes?: OutcomeRow[]
      performance?: PerformanceRow[]
      unattributed?: unknown[]
      integrations?: IntegrationRow[]
      oauthConfigured?: Record<string, boolean>
      performanceUnavailable?: boolean
      error?: string
    } | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load outcomes.')
    setOutcomes(body?.outcomes ?? [])
    setPerformance(body?.performance ?? [])
    setPerformanceUnavailable(Boolean(body?.performanceUnavailable))
    setUnattributedCount(body?.unattributed?.length ?? 0)
    setIntegrations(body?.integrations ?? [])
    setOauthConfigured(body?.oauthConfigured ?? {})
  }, [])

  useEffect(() => {
    const id = readActiveProductIdFromDocument()
    setProductId(id)
    if (!id) {
      setLoading(false)
      setError('Select or create a Product first.')
      return
    }
    void load(id)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load outcomes.'))
      .finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const oauth = params.get('oauth')
    const reason = params.get('reason')
    if (connected) {
      setNotice(
        `${connected} connected via OAuth. Pulls stay stubbed until a live adapter is approved.`,
      )
    } else if (oauth === 'denied') {
      setError(reason ?? 'OAuth was denied.')
    } else if (oauth === 'missing') {
      setError('OAuth callback was missing a code. Start Connect again.')
    } else if (oauth === 'error') {
      setError(reason ?? 'Could not start OAuth.')
    }
  }, [])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!productId) return
    setBusy('Saving outcome…')
    setError(null)
    setNotice(null)
    setRefreshWarning(null)
    void (async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric,
          value: Number(value),
          externalUrl: externalUrl.trim() || undefined,
          finalAssetId: finalAssetId.trim() || undefined,
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        attributed?: boolean
        refreshWarning?: string | null
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not save outcome.')
      setNotice(
        body?.attributed
          ? 'Outcome attached to a Final.'
          : 'No matching posted URL or Final id. Stored as unattributed activity.',
      )
      setRefreshWarning(body?.refreshWarning?.trim() || null)
      setExternalUrl('')
      setFinalAssetId('')
      await load(productId)
    })()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not save outcome.'))
      .finally(() => setBusy(null))
  }

  const pullStub = (provider: string) => {
    if (!productId) return
    setBusy(`Pulling ${provider} (stub)…`)
    setError(null)
    void (async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', provider }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        reason?: string
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Pull failed.')
      setNotice(
        body?.reason === 'not_connected'
          ? `${provider} is not connected. Paste a token in the form above.`
          : `${provider} adapter is stubbed in v1. No live rows.`,
      )
      await load(productId)
    })()
      .catch((err) =>
        setError(err instanceof Error ? humanizeOutcomesError(err.message) : 'Pull failed.'),
      )
      .finally(() => setBusy(null))
  }

  const pullAll = () => {
    if (!productId) return
    setBusy('Running pull worker…')
    setError(null)
    setNotice(null)
    void (async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull-all' }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        results?: Array<{ provider: string; reason: string }>
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Pull worker failed.')
      const count = body?.results?.length ?? 0
      setNotice(
        count === 0
          ? 'Pull worker ran. No connected providers yet.'
          : `Pull worker ran on ${count} connection${count === 1 ? '' : 's'}. Adapters stay stubbed.`,
      )
      await load(productId)
    })()
      .catch((err) =>
        setError(err instanceof Error ? humanizeOutcomesError(err.message) : 'Pull worker failed.'),
      )
      .finally(() => setBusy(null))
  }

  const disconnect = (provider: string) => {
    if (!productId) return
    setBusy(`Disconnecting ${provider}…`)
    setError(null)
    void (async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect', provider }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Disconnect failed.')
      setNotice(`${provider} disconnected.`)
      await load(productId)
    })()
      .catch((err) => setError(err instanceof Error ? err.message : 'Disconnect failed.'))
      .finally(() => setBusy(null))
  }

  const saveToken = (event: FormEvent) => {
    event.preventDefault()
    if (!productId) return
    setBusy('Saving token…')
    setError(null)
    setNotice(null)
    void (async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'token', provider: tokenProvider, token }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not save token.')
      setToken('')
      setNotice(
        `${tokenProvider} token stored. Pulls stay stubbed until a live adapter is approved.`,
      )
      await load(productId)
    })()
      .catch((err) =>
        setError(
          err instanceof Error ? humanizeOutcomesError(err.message) : 'Could not save token.',
        ),
      )
      .finally(() => setBusy(null))
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
            Outcomes
          </p>
          <h1 className="settings-title">Outcomes</h1>
          <p className="page-lede">
            Manual metrics first. Connect a provider with OAuth when the app ids are set, or paste a
            token. Unmatched URLs stay unattributed. Pulls stay stubbed until a live adapter is
            approved.
          </p>
        </div>
        <div className="settings-header-actions">
          <Link href="/settings" className="btn btn-ghost">
            All settings
          </Link>
          <Link href="/content" className="btn btn-primary">
            Work board
          </Link>
        </div>
      </header>
      <SettingsLocalNav />

      {!productId ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before recording outcomes.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}
      {loading ? (
        <p className="page-lede" role="status">
          Loading outcomes…
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
      {refreshWarning ? (
        <div className="settings-alert is-warn" role="alert">
          <p>{refreshWarning}</p>
        </div>
      ) : null}

      {productId && !loading ? (
        <>
          <h2 className="section-title">Record a metric</h2>
          <form
            onSubmit={onSubmit}
            className="auth-form members-invite-form"
            aria-busy={Boolean(busy)}
          >
            <label htmlFor={metricId}>
              Metric
              <select
                id={metricId}
                value={metric}
                onChange={(event) =>
                  setMetric(event.target.value as 'views' | 'clicks' | 'signups' | 'revenue')
                }
              >
                <option value="views">Views</option>
                <option value="clicks">Clicks</option>
                <option value="signups">Signups</option>
                <option value="revenue">Revenue</option>
              </select>
            </label>
            <label htmlFor={valueId}>
              Value
              <input
                id={valueId}
                type="number"
                step="any"
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <label htmlFor={urlId}>
              Posted URL (optional)
              <input
                id={urlId}
                type="url"
                value={externalUrl}
                onChange={(event) => setExternalUrl(event.target.value)}
                placeholder="https://x.com/you/status/123"
              />
            </label>
            <label htmlFor={finalId}>
              Final id (optional)
              <input
                id={finalId}
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                value={finalAssetId}
                onChange={(event) => setFinalAssetId(event.target.value)}
                placeholder="uuid from /content/finals/…"
              />
            </label>
            <button type="submit" className="auth-submit" disabled={Boolean(busy)}>
              Save outcome
            </button>
          </form>

          <h2 className="section-title">Connections</h2>
          <p className="page-lede">
            Tokens are encrypted and never shown again. OAuth Connect fails closed until the
            provider app ids and PERFORMANCE_TOKEN_KEY are set.
            {integrations.filter((row) => row.status === 'connected').length > 0
              ? ` ${integrations.filter((row) => row.status === 'connected').length} connected.`
              : ''}
          </p>
          <ul className="settings-row-list outcomes-connections">
            {TOKEN_PROVIDERS.map((provider) => {
              const row = integrations.find((item) => item.provider === provider)
              const connected = row?.status === 'connected'
              const oauthReady = Boolean(oauthConfigured[provider])
              return (
                <li key={provider}>
                  <div>
                    <strong>{provider}</strong>
                    <p className="muted">
                      {connected
                        ? `${row?.auth_kind === 'oauth' ? 'OAuth' : 'Token'} · last pull ${
                            row?.last_pull_reason ?? 'not run'
                          }`
                        : oauthReady
                          ? 'OAuth app is configured. Connect or paste a token.'
                          : 'OAuth app not configured. Paste a token.'}
                    </p>
                  </div>
                  <div className="settings-header-actions">
                    {oauthReady && productId && provider === 'shopify' ? (
                      <label className="outcomes-shop">
                        <span className="visually-hidden">Shopify shop subdomain</span>
                        <input
                          type="text"
                          value={shopDomain}
                          onChange={(event) => setShopDomain(event.target.value)}
                          placeholder="your-shop.myshopify.com"
                          autoComplete="off"
                        />
                      </label>
                    ) : null}
                    {oauthReady && productId ? (
                      <a
                        className="btn btn-ghost btn-sm"
                        href={`/api/products/${encodeURIComponent(productId)}/integrations/oauth/${provider}${
                          provider === 'shopify' && shopDomain.trim()
                            ? `?shop=${encodeURIComponent(shopDomain.trim())}`
                            : ''
                        }`}
                      >
                        Connect
                      </a>
                    ) : null}
                    {connected ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={Boolean(busy)}
                        onClick={() => disconnect(provider)}
                      >
                        Disconnect
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={Boolean(busy)}
                      onClick={() => pullStub(provider)}
                    >
                      Pull
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <form
            onSubmit={saveToken}
            className="auth-form members-invite-form"
            aria-busy={Boolean(busy)}
          >
            <label htmlFor={tokenProviderId}>
              Provider
              <select
                id={tokenProviderId}
                value={tokenProvider}
                onChange={(event) =>
                  setTokenProvider(event.target.value as (typeof TOKEN_PROVIDERS)[number])
                }
              >
                {TOKEN_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={tokenId}>
              Token
              <input
                id={tokenId}
                type="password"
                autoComplete="off"
                required
                minLength={8}
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
            <button type="submit" className="auth-submit" disabled={Boolean(busy)}>
              Save token
            </button>
          </form>
          <div className="settings-header-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(busy) || !productId}
              onClick={() => pullAll()}
            >
              Run pull worker
            </button>
          </div>

          <h2 className="section-title">Recent outcomes</h2>
          <ul className="settings-row-list">
            {outcomes.length === 0 ? (
              <li className="settings-empty-inline">
                <p>No attributed outcomes yet. Save a metric with a matching posted URL.</p>
              </li>
            ) : (
              outcomes.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>
                      {METRIC_LABEL[row.metric] ?? row.metric} · {row.value}
                    </strong>
                    <p className="muted">
                      {row.source}
                      {row.final_asset_id ? (
                        <>
                          {' '}
                          · <Link href={`/content/finals/${row.final_asset_id}`}>View Final</Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>

          <h2 className="section-title">Final rollup</h2>
          <p className="muted">
            {unattributedCount} unattributed row{unattributedCount === 1 ? '' : 's'}.
            {performanceUnavailable
              ? ' Rollup is unavailable until the performance view is migrated.'
              : ''}
          </p>
          <ul className="settings-row-list">
            {performance.length === 0 ? (
              <li className="settings-empty-inline">
                <p>No Final rollup yet. Approve a cut, then record an outcome against its URL.</p>
              </li>
            ) : (
              performance.map((row) => (
                <li key={row.final_asset_id}>
                  <div>
                    <Link href={`/content/finals/${row.final_asset_id}`}>Final snapshot</Link>
                    <p className="muted">
                      {row.beat_count} beats · {row.views} views · {row.clicks} clicks ·{' '}
                      {row.signups} signups
                    </p>
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
