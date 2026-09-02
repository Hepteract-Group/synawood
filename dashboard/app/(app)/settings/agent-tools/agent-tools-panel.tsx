'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  HOSTED_LOCALHOST_MCP_COPY,
  HOSTED_REMOTE_ONLY_MCP_COPY,
  hostedMcpRejectCopy,
  type McpTransport,
} from '@synawood/creative/mcp/inbound-copy'
import { useActiveProduct } from '../../../../lib/use-active-product'
import { SettingsLocalNav } from '../settings-local-nav'

type CatalogRow = {
  id: string
  name: string
  source: 'first-party' | 'mcp'
  kind: 'locked' | 'optional' | 'policy'
  enabled: boolean
  toggleable: boolean
  warning: string | null
  stale?: boolean
}

type AgentToolsResponse = {
  disabledOptional?: string[]
  canEdit?: boolean
  catalog?: CatalogRow[]
  error?: string
}

type McpServerPublic = {
  id: string
  displayName: string
  transport: McpTransport
  endpoint: string
  status: 'disconnected' | 'connected' | 'error'
  lastHealthAt: string | null
  lastHealthError: string | null
  hasAuth: boolean
}

type McpServersResponse = {
  servers?: McpServerPublic[]
  hosted?: boolean
  localTransportsAllowed?: boolean
  canEdit?: boolean
  schemaMissing?: boolean
  error?: string
}

const kindLabel = (kind: CatalogRow['kind']): string => {
  if (kind === 'locked') return 'Always on'
  if (kind === 'policy') return 'Policy'
  return 'Optional'
}

export const AgentToolsPanel = () => {
  const { productId, loading: productLoading } = useActiveProduct()
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [disabledOptional, setDisabledOptional] = useState<string[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyName, setBusyName] = useState<string | null>(null)
  const [mcpServers, setMcpServers] = useState<McpServerPublic[]>([])
  const [hosted, setHosted] = useState(true)
  const [localAllowed, setLocalAllowed] = useState(false)
  const [mcpCanEdit, setMcpCanEdit] = useState(false)
  const [mcpBusy, setMcpBusy] = useState<string | null>(null)
  const [mcpSchemaMissing, setMcpSchemaMissing] = useState(false)
  const [pingingId, setPingingId] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [transport, setTransport] = useState<McpTransport>('https')
  const [endpoint, setEndpoint] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/studio/agent-tools?productId=${encodeURIComponent(id)}`)
    const body = (await response.json().catch(() => null)) as AgentToolsResponse | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load agent tools.')
    setCatalog(body?.catalog ?? [])
    setDisabledOptional(body?.disabledOptional ?? [])
    setCanEdit(body?.canEdit === true)
  }, [])

  const loadMcp = useCallback(async (id: string) => {
    const response = await fetch(`/api/studio/mcp-servers?productId=${encodeURIComponent(id)}`)
    const body = (await response.json().catch(() => null)) as McpServersResponse | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load MCP servers.')
    setMcpServers(body?.servers ?? [])
    setHosted(body?.hosted !== false)
    setLocalAllowed(body?.localTransportsAllowed === true)
    setMcpCanEdit(body?.canEdit === true)
    setMcpSchemaMissing(body?.schemaMissing === true)
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
    void Promise.all([load(productId), loadMcp(productId)])
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load agent tools.'))
      .finally(() => setLoading(false))
  }, [load, loadMcp, productId, productLoading])

  const videoOff = disabledOptional.includes('generate_video_clip')
  const videoWarning =
    catalog.find((row) => row.id === 'generate_video_clip')?.warning ??
    'Make a video will fail until you turn generate_video_clip back on in Settings → Agent tools. Cut review is not skipped.'

  const onToggleMcp = async (catalogId: string, enable: boolean) => {
    if (!productId || !canEdit) return
    setBusyName(catalogId)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/studio/agent-tools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, mcpTool: { catalogId, enabled: enable } }),
      })
      const body = (await response.json().catch(() => null)) as AgentToolsResponse | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not save agent tools.')
      setCatalog(body?.catalog ?? [])
      setDisabledOptional(body?.disabledOptional ?? disabledOptional)
      const row = body?.catalog?.find((item) => item.id === catalogId)
      setNotice(
        enable
          ? `${row?.name ?? 'MCP tool'} is on for this Product.`
          : `${row?.name ?? 'MCP tool'} is off for this Product.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save agent tools.')
    } finally {
      setBusyName(null)
    }
  }

  const onRemoveMcp = async (catalogId: string) => {
    if (!productId || !canEdit) return
    setBusyName(catalogId)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/studio/agent-tools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, mcpToolRemove: { catalogId } }),
      })
      const body = (await response.json().catch(() => null)) as AgentToolsResponse | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not remove MCP tool.')
      setCatalog(body?.catalog ?? [])
      setDisabledOptional(body?.disabledOptional ?? disabledOptional)
      const row = body?.catalog?.find((item) => item.id === catalogId)
      setNotice(`${row?.name ?? 'Stale MCP tool'} removed.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove MCP tool.')
    } finally {
      setBusyName(null)
    }
  }

  const onToggle = async (name: string, enable: boolean) => {
    if (!productId || !canEdit) return
    const nextDisabled = enable
      ? disabledOptional.filter((item) => item !== name)
      : [...new Set([...disabledOptional, name])]
    setBusyName(name)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/studio/agent-tools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, disabledOptional: nextDisabled }),
      })
      const body = (await response.json().catch(() => null)) as AgentToolsResponse | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not save agent tools.')
      setCatalog(body?.catalog ?? [])
      setDisabledOptional(body?.disabledOptional ?? nextDisabled)
      if (!enable && name === 'generate_video_clip') {
        setNotice(null)
      } else {
        setNotice(enable ? `${name} is on for this Product.` : `${name} is off for this Product.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save agent tools.')
    } finally {
      setBusyName(null)
    }
  }

  const onRegisterMcp = async () => {
    if (!productId || !mcpCanEdit) return
    setMcpBusy('register')
    setError(null)
    setNotice(null)
    setFieldError(null)
    const reject = hostedMcpRejectCopy({ transport, endpoint, hosted })
    if (reject) {
      setFieldError(reject)
      setMcpBusy(null)
      return
    }
    try {
      const response = await fetch('/api/studio/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          displayName,
          transport,
          endpoint,
          authToken,
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        server?: McpServerPublic
        error?: string
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not register MCP server.')
      const registered = body?.server
      setDisplayName('')
      setEndpoint('')
      setAuthToken('')
      await loadMcp(productId)
      if (registered?.id && registered.transport !== 'stdio') {
        await onPingMcp(registered.id)
        return
      }
      setNotice(`${registered?.displayName ?? displayName} is registered. Auth is not shown again.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not register MCP server.'
      if (message === HOSTED_LOCALHOST_MCP_COPY || message === HOSTED_REMOTE_ONLY_MCP_COPY) {
        setFieldError(message)
      } else setError(message)
    } finally {
      setMcpBusy(null)
    }
  }

  const onPingMcp = async (serverId: string) => {
    if (!productId || !mcpCanEdit) return
    setPingingId(serverId)
    setError(null)
    try {
      const response = await fetch(
        `/api/studio/mcp-servers/${encodeURIComponent(serverId)}/health`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        },
      )
      const body = (await response.json().catch(() => null)) as {
        server?: McpServerPublic
        error?: string
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Health ping failed.')
      await loadMcp(productId)
      const server = body?.server
      if (server?.status === 'connected') {
        setNotice(`${server.displayName} is connected.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health ping failed.')
    } finally {
      setPingingId(null)
    }
  }

  const onRefreshMcpTools = async (serverId: string) => {
    if (!productId || !mcpCanEdit) return
    setRefreshingId(serverId)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(
        `/api/studio/mcp-servers/${encodeURIComponent(serverId)}/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        },
      )
      const body = (await response.json().catch(() => null)) as {
        tools?: unknown[]
        error?: string
      } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not refresh MCP tools.')
      await Promise.all([load(productId), loadMcp(productId)])
      const count = body?.tools?.length ?? 0
      const server = mcpServers.find((item) => item.id === serverId)
      setNotice(
        count === 0
          ? `${server?.displayName ?? 'MCP server'} returned no tools.`
          : `${server?.displayName ?? 'MCP server'}: ${count} tool${count === 1 ? '' : 's'} in the catalog (new tools stay off).`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh MCP tools.')
    } finally {
      setRefreshingId(null)
    }
  }

  const onDisconnectMcp = async (serverId: string) => {
    if (!productId || !mcpCanEdit) return
    setMcpBusy(serverId)
    setError(null)
    try {
      const response = await fetch(
        `/api/studio/mcp-servers/${encodeURIComponent(serverId)}?productId=${encodeURIComponent(productId)}`,
        { method: 'DELETE' },
      )
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not disconnect MCP server.')
      setNotice('MCP server disconnected.')
      await loadMcp(productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect MCP server.')
    } finally {
      setMcpBusy(null)
    }
  }

  const policyRows = catalog.filter((row) => row.kind === 'policy')
  const lockedRows = catalog.filter((row) => row.kind === 'locked')
  const optionalRows = catalog.filter(
    (row) => row.kind === 'optional' && row.source === 'first-party' && row.toggleable,
  )
  const otherRows = catalog.filter(
    (row) => row.kind === 'optional' && row.source === 'first-party' && !row.toggleable,
  )
  const mcpRows = catalog.filter((row) => row.source === 'mcp')
  const pingingName = mcpServers.find((server) => server.id === pingingId)?.displayName
  const refreshingName = mcpServers.find((server) => server.id === refreshingId)?.displayName
  const mcpHealthErrors = mcpServers.filter((server) => server.status === 'error')

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/settings" className="settings-crumb">
              Settings
            </Link>
            <span aria-hidden> / </span>
            Agent tools
          </p>
          <h1 className="settings-title">Agent tools</h1>
          <p className="page-lede">
            Every first-party Studio tool for this Product. Locked tools and spend/approve rules
            stay on. Optional generators can be turned off — that is not a silent skip of cut
            review.
          </p>
        </div>
        <div className="settings-header-actions">
          <Link href="/settings" className="btn btn-ghost">
            All settings
          </Link>
          <Link href="/studio" className="btn btn-primary">
            Open Studio
          </Link>
        </div>
      </header>
      <SettingsLocalNav />

      {!productLoading && !productId ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before changing agent tools.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}

      {loading ? (
        <p className="page-lede" role="status" aria-live="polite">
          Loading agent tools…
        </p>
      ) : null}

      {error ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {mcpSchemaMissing ? (
        <div className="settings-alert is-error" role="alert">
          <p>
            Inbound MCP is not set up on this workspace yet. Finish database setup, then reload.
            This is not an empty catalog.
          </p>
        </div>
      ) : null}

      {mcpHealthErrors.map((server) => (
        <div key={server.id} className="settings-alert is-error" role="alert">
          <p>
            {server.displayName} health failed
            {server.lastHealthError ? `: ${server.lastHealthError}` : '.'}
          </p>
        </div>
      ))}

      {videoOff ? (
        <div className="settings-alert is-warn" role="alert">
          <p>{videoWarning}</p>
        </div>
      ) : null}

      {refreshingId ? (
        <div className="settings-alert" role="status" aria-live="polite">
          <p>
            Refreshing tools from {refreshingName ?? 'MCP server'}… New tools stay off until you
            enable them.
          </p>
        </div>
      ) : null}

      {pingingId ? (
        <div className="settings-alert" role="status" aria-live="polite">
          <p>
            Checking {pingingName ?? 'MCP server'}… Last health stays on the server if you leave
            this page.
          </p>
        </div>
      ) : null}

      {notice && !videoOff ? (
        <div className="settings-alert is-ok" role="status">
          <p>{notice}</p>
        </div>
      ) : null}

      {productId && !loading ? (
        <>
          <h2 className="section-title">Always on</h2>
          <ul className="settings-row-list agent-tools-list">
            {[...policyRows, ...lockedRows].map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.name}</strong>
                  <p className="muted">
                    {kindLabel(row.kind)} · first-party · cannot be turned off
                  </p>
                </div>
                <span className="agent-tools-lock">On</span>
              </li>
            ))}
          </ul>

          <h2 className="section-title">Optional generators</h2>
          <p className="page-lede">
            Turn a generator off when this Product must not spend on it. Locked cut-review tools
            stay in the list above.
          </p>
          <ul className="settings-row-list agent-tools-list">
            {optionalRows.map((row) => {
              const enabled = row.enabled
              return (
                <li key={row.id}>
                  <div>
                    <strong>{row.name}</strong>
                    <p className="muted">
                      {enabled ? 'On for this Product' : 'Off for this Product'}
                    </p>
                  </div>
                  <label className="agent-tools-switch">
                    <span className="visually-hidden">
                      {enabled ? `Turn off ${row.name}` : `Turn on ${row.name}`}
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={enabled}
                      disabled={!canEdit || busyName === row.name}
                      onChange={(event) => void onToggle(row.name, event.target.checked)}
                    />
                    <span aria-hidden>{enabled ? 'On' : 'Off'}</span>
                  </label>
                </li>
              )
            })}
          </ul>

          <details className="agent-tools-more">
            <summary>Other first-party tools ({otherRows.length})</summary>
            <ul className="settings-row-list agent-tools-list">
              {otherRows.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.name}</strong>
                    <p className="muted">First-party · always available in this catalog</p>
                  </div>
                  <span className="agent-tools-lock">On</span>
                </li>
              ))}
            </ul>
          </details>

          <h2 className="section-title">MCP servers</h2>
          <p className="page-lede">
            Connect a server this organization can call. Tokens stay on the server and are never
            shown again. After you connect, the agent may send timeline and brand data when you turn
            a tool on. Hosted Studio only accepts public HTTPS addresses.
          </p>
          {mcpCanEdit && !mcpSchemaMissing ? (
            <form
              className="auth-form mcp-register"
              onSubmit={(event) => {
                event.preventDefault()
                void onRegisterMcp()
              }}
            >
              <label htmlFor="mcp-display-name">
                Display name
                <input
                  id="mcp-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
              <label htmlFor="mcp-transport">
                Transport
                <select
                  id="mcp-transport"
                  value={transport}
                  onChange={(event) => setTransport(event.target.value as McpTransport)}
                >
                  <option value="https">HTTPS remote</option>
                  {localAllowed ? <option value="loopback">Loopback (127.0.0.1)</option> : null}
                  {localAllowed ? <option value="stdio">stdio command</option> : null}
                </select>
              </label>
              {hosted ? (
                <p className="page-lede" role="status">
                  {HOSTED_REMOTE_ONLY_MCP_COPY}
                </p>
              ) : null}
              <label htmlFor="mcp-endpoint">
                {transport === 'stdio' ? 'Command' : 'URL'}
                <input
                  id="mcp-endpoint"
                  value={endpoint}
                  onChange={(event) => {
                    setEndpoint(event.target.value)
                    setFieldError(null)
                  }}
                  placeholder={
                    transport === 'stdio'
                      ? 'npx -y my-mcp'
                      : hosted
                        ? 'https://mcp.example.com/sse'
                        : 'http://127.0.0.1:3939'
                  }
                  required
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? 'mcp-endpoint-error' : undefined}
                />
              </label>
              {fieldError ? (
                <p id="mcp-endpoint-error" className="error" role="alert">
                  {fieldError}
                </p>
              ) : null}
              <label htmlFor="mcp-auth-token">
                Auth token{hosted ? '' : ' (optional)'}
                <input
                  id="mcp-auth-token"
                  type="password"
                  value={authToken}
                  onChange={(event) => setAuthToken(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Stored encrypted. Never shown again."
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={mcpBusy === 'register'}>
                Register MCP server
              </button>
            </form>
          ) : null}
          {mcpSchemaMissing ? null : mcpServers.length === 0 ? (
            <div className="settings-empty">
              <h3 className="settings-empty-title">No inbound MCP servers yet</h3>
              <p className="page-lede">
                Register a server for this organization. Extra tools show up here after you connect.
                Nothing is registered yet.
              </p>
            </div>
          ) : (
            <ul className="settings-row-list agent-tools-list">
              {mcpServers.map((server) => (
                <li key={server.id}>
                  <div>
                    <strong>{server.displayName}</strong>
                    <p className="muted">
                      {server.transport} · {server.status}
                      {server.hasAuth ? ' · auth stored' : ''}
                      {server.lastHealthError ? ` · ${server.lastHealthError}` : ''}
                    </p>
                  </div>
                  {mcpCanEdit ? (
                    <div className="mcp-server-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={Boolean(refreshingId) || server.transport === 'stdio'}
                        onClick={() => void onRefreshMcpTools(server.id)}
                      >
                        Refresh tools
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={Boolean(pingingId)}
                        onClick={() => void onPingMcp(server.id)}
                      >
                        Check health
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={mcpBusy === server.id}
                        onClick={() => void onDisconnectMcp(server.id)}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {mcpRows.length > 0 ? (
            <>
              <h3 className="section-title">MCP tools</h3>
              <p className="page-lede">
                Tools discovered from your servers. New tools stay off until you turn them on here.
              </p>
              <ul className="settings-row-list agent-tools-list">
                {mcpRows.map((row) => {
                  const enabled = row.enabled
                  const stale = row.stale === true
                  return (
                    <li key={row.id} className={stale ? 'agent-tools-row-stale' : undefined}>
                      <div>
                        <strong>{row.name}</strong>
                        <p className="muted">
                          MCP ·{' '}
                          {stale
                            ? 'Stale — no longer returned by the server'
                            : enabled
                              ? 'On for this Product'
                              : 'Off for this Product'}
                        </p>
                        {row.warning ? (
                          <p className="muted" role="status">
                            {row.warning}
                          </p>
                        ) : null}
                      </div>
                      {stale ? (
                        canEdit ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busyName === row.id}
                            onClick={() => void onRemoveMcp(row.id)}
                          >
                            Remove
                          </button>
                        ) : null
                      ) : (
                        <label className="agent-tools-switch">
                          <span className="visually-hidden">
                            {enabled ? `Turn off ${row.name}` : `Turn on ${row.name}`}
                          </span>
                          <input
                            type="checkbox"
                            role="switch"
                            checked={enabled}
                            disabled={!canEdit || busyName === row.id}
                            onChange={(event) => void onToggleMcp(row.id, event.target.checked)}
                          />
                          <span aria-hidden>{enabled ? 'On' : 'Off'}</span>
                        </label>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
