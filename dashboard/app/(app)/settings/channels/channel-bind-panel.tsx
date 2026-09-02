'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  integrationsForOrganicChannel,
  ORGANIC_POSTIZ_CHANNEL_LABEL,
  ORGANIC_POSTIZ_CHANNELS,
  type OrganicPostizChannel,
  type ProductChannelIntegration,
} from '@synawood/channels/organic-postiz-channel'
import {
  POSTIZ_ORGANIC_SCOPE_NOTE,
  type PostizIntegration,
} from '@synawood/channels/postiz-channel-bind'
import { PRODUCT_NAME } from '../../../../lib/product-name'
import { useActiveProduct } from '../../../../lib/use-active-product'
import { SettingsLocalNav } from '../settings-local-nav'

type BindResponse = {
  integrations?: PostizIntegration[]
  bindings?: ProductChannelIntegration[]
  unboundChannels?: OrganicPostizChannel[]
  canEdit?: boolean
  schemaMissing?: boolean
  postizConfigured?: boolean
  postizAppUrl?: string | null
  error?: string
}

const UNBOUND_TITLE = 'These channels have no Postiz account'
const UNBOUND_BODY = `Connect X, LinkedIn, or TikTok in Postiz, then pick which ${PRODUCT_NAME} channel uses which account. Or open a Final’s card on the Work board and paste the live URL.`
const NO_ACCOUNTS_TITLE = 'No Postiz accounts connected'
const NO_ACCOUNTS_BODY = `Open Postiz in a new tab, connect X, LinkedIn, or TikTok, then reload this page. ${PRODUCT_NAME} only lists accounts that already exist there.`
const NOT_CONFIGURED_TITLE = 'Postiz is not configured'
const NOT_CONFIGURED_BODY = `Connect a live Postiz instance, then bind which ${PRODUCT_NAME} channel uses which account. Paid ads, blog, and email stay on paste URL on the Final’s Work board card.`

export const ChannelBindPanel = () => {
  const { productId, loading: productLoading } = useActiveProduct()
  const [integrations, setIntegrations] = useState<PostizIntegration[]>([])
  const [bindings, setBindings] = useState<ProductChannelIntegration[]>([])
  const [unboundChannels, setUnboundChannels] = useState<OrganicPostizChannel[]>([
    ...ORGANIC_POSTIZ_CHANNELS,
  ])
  const [canEdit, setCanEdit] = useState(false)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [postizConfigured, setPostizConfigured] = useState(false)
  const [postizAppUrl, setPostizAppUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyChannel, setBusyChannel] = useState<string | null>(null)

  const apply = (body: BindResponse) => {
    setIntegrations(body.integrations ?? [])
    setBindings(body.bindings ?? [])
    setUnboundChannels(body.unboundChannels ?? [...ORGANIC_POSTIZ_CHANNELS])
    setCanEdit(body.canEdit === true)
    setSchemaMissing(body.schemaMissing === true)
    setPostizConfigured(body.postizConfigured === true)
    setPostizAppUrl(typeof body.postizAppUrl === 'string' ? body.postizAppUrl : null)
  }

  const load = useCallback(async (id: string) => {
    const response = await fetch(
      `/api/studio/channel-integrations?productId=${encodeURIComponent(id)}`,
    )
    const body = (await response.json().catch(() => null)) as BindResponse | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load Postiz channels.')
    apply(body ?? {})
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
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load Postiz channels.'),
      )
      .finally(() => setLoading(false))
  }, [load, productId, productLoading])

  const boundId = (channel: OrganicPostizChannel): string =>
    bindings.find((row) => row.channel === channel)?.postizIntegrationId ?? ''

  const onBind = async (channel: OrganicPostizChannel, postizIntegrationId: string) => {
    if (!productId || !canEdit) return
    setBusyChannel(channel)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/studio/channel-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, channel, postizIntegrationId }),
      })
      const body = (await response.json().catch(() => null)) as BindResponse | null
      if (!response.ok) throw new Error(body?.error ?? 'Could not bind channel.')
      apply(body ?? {})
      const label = ORGANIC_POSTIZ_CHANNEL_LABEL[channel]
      setNotice(postizIntegrationId ? `${label} is bound.` : `${label} is unbound.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not bind channel.')
    } finally {
      setBusyChannel(null)
    }
  }

  const noneBound = unboundChannels.length === ORGANIC_POSTIZ_CHANNELS.length
  const noAccounts = integrations.length === 0
  const hasBindings = bindings.length > 0
  const showRows = !noAccounts || hasBindings
  const showEmptyNoAccounts = noAccounts && !hasBindings

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/settings" className="settings-crumb">
              Settings
            </Link>
            <span aria-hidden> / </span>
            Postiz channels
          </p>
          <h1 className="settings-title">Postiz channels</h1>
          <p className="page-lede">
            Connect X, LinkedIn, and TikTok in Postiz (new tab). Then bind which {PRODUCT_NAME}{' '}
            channel uses which connected account. Paid ads, blog, and email never go through Postiz
            — paste those live URLs on the Final’s Work board card after you Approve.
          </p>
        </div>
        <div className="settings-header-actions">
          {postizAppUrl ? (
            <a className="btn btn-ghost" href={postizAppUrl} target="_blank" rel="noreferrer">
              Open Postiz
            </a>
          ) : null}
          <Link href="/settings" className="btn btn-ghost">
            All settings
          </Link>
          <Link href="/content" className="btn btn-primary">
            Work board
          </Link>
        </div>
      </header>
      <SettingsLocalNav />

      {!productLoading && !productId ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before binding Postiz accounts.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}

      {loading ? (
        <p className="page-lede" role="status" aria-live="polite">
          Loading Postiz channels…
        </p>
      ) : null}

      {error ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {schemaMissing ? (
        <div className="settings-alert is-error" role="alert">
          <p>
            Channel bindings are not set up on this workspace yet. Finish database setup, then
            reload.
          </p>
        </div>
      ) : null}

      {notice ? (
        <div className="settings-alert" role="status">
          <p>{notice}</p>
        </div>
      ) : null}

      {productId && !loading && !schemaMissing ? (
        <>
          <div className="settings-alert" role="note">
            <p>{POSTIZ_ORGANIC_SCOPE_NOTE}</p>
          </div>

          {showEmptyNoAccounts ? (
            <div className="settings-empty" role="status">
              <h2 className="settings-empty-title">
                {postizConfigured ? NO_ACCOUNTS_TITLE : NOT_CONFIGURED_TITLE}
              </h2>
              <p className="page-lede">
                {postizConfigured ? NO_ACCOUNTS_BODY : NOT_CONFIGURED_BODY}
              </p>
              {postizAppUrl ? (
                <a className="btn btn-primary" href={postizAppUrl} target="_blank" rel="noreferrer">
                  Open Postiz
                </a>
              ) : null}
            </div>
          ) : null}

          {!noAccounts && noneBound ? (
            <div className="settings-empty" role="status">
              <h2 className="settings-empty-title">{UNBOUND_TITLE}</h2>
              <p className="page-lede">{UNBOUND_BODY}</p>
            </div>
          ) : null}

          {showRows && unboundChannels.length > 0 && !noneBound ? (
            <div className="settings-alert is-warn" role="status">
              <p>
                {unboundChannels.map((channel) => ORGANIC_POSTIZ_CHANNEL_LABEL[channel]).join(', ')}{' '}
                {unboundChannels.length === 1 ? 'has' : 'have'} no Postiz account. Bind{' '}
                {unboundChannels.length === 1 ? 'it' : 'them'} here or paste the live URL on the
                Final’s Work board card.
              </p>
            </div>
          ) : null}

          {!canEdit && showRows ? (
            <p className="page-lede">
              Viewers can see bindings. Owners and editors can change them.
            </p>
          ) : null}

          {showRows ? (
            <ul className="settings-row-list">
              {ORGANIC_POSTIZ_CHANNELS.map((channel) => {
                const selected = boundId(channel)
                const label = ORGANIC_POSTIZ_CHANNEL_LABEL[channel]
                const boundName = integrations.find((row) => row.id === selected)?.name ?? selected
                return (
                  <li key={channel}>
                    <div>
                      <strong>{label}</strong>
                      <p className="page-lede">
                        {selected ? `Bound to ${boundName}` : 'This channel has no Postiz account'}
                      </p>
                    </div>
                    {noAccounts ? (
                      selected && canEdit ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busyChannel === channel}
                          onClick={() => void onBind(channel, '')}
                        >
                          Unbind
                        </button>
                      ) : null
                    ) : (
                      <label className="settings-bind-label">
                        <span className="visually-hidden">Postiz account for {label}</span>
                        <select
                          value={selected}
                          disabled={!canEdit || busyChannel === channel}
                          onChange={(event) => void onBind(channel, event.target.value)}
                        >
                          <option value="">Not bound</option>
                          {integrationsForOrganicChannel(channel, integrations, bindings).map(
                            (row) => (
                              <option key={row.id} value={row.id}>
                                {row.name}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
