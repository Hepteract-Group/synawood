'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { readActiveProductIdFromDocument } from '../../../../lib/active-product-cookie'
import { readApiJson } from '../../../../lib/read-api-json'
import { SettingsLocalNav } from '../settings-local-nav'

type AuditRow = {
  id: string
  actorUserId: string | null
  action: string
  payload: Record<string, unknown>
  createdAt: string
}

const ACTION_LABEL: Record<string, string> = {
  'member.created': 'Member added',
  'invite.created': 'Invite created',
  'invite.revoked': 'Invite revoked',
  'invite.accepted': 'Invite accepted',
  'member.functional_role.changed': 'Job function changed',
}

const actionLabel = (action: string): string => ACTION_LABEL[action] ?? action

const shortId = (userId: string): string =>
  userId.length <= 12 ? userId : `${userId.slice(0, 8)}…${userId.slice(-4)}`

const formatWhen = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const payloadLine = (payload: Record<string, unknown>): string => {
  const email = typeof payload.email === 'string' ? payload.email : null
  const from = typeof payload.from === 'string' ? payload.from : null
  const to = typeof payload.to === 'string' ? payload.to : null
  const role = typeof payload.functionalRole === 'string' ? payload.functionalRole : null
  if (from && to) return `${from} → ${to}`
  if (email && role) return `${email} as ${role}`
  if (email) return email
  if (role) return role
  const keys = Object.keys(payload)
  if (keys.length === 0) return ''
  return keys
    .slice(0, 4)
    .map((key) => `${key}: ${String(payload[key])}`)
    .join(' · ')
}

export const AuditPanel = () => {
  const [productId, setProductId] = useState<string | null>(null)
  const [events, setEvents] = useState<AuditRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}/audit`)
    const body = await readApiJson<{ events?: AuditRow[]; error?: string }>(response)
    if (!response.ok) {
      throw new Error(body.error ?? 'Could not load the audit log.')
    }
    setEvents(body.events ?? [])
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
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load the audit log.'),
      )
      .finally(() => setLoading(false))
  }, [load])

  const empty = useMemo(
    () => !loading && events.length === 0 && !error,
    [loading, events.length, error],
  )

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/settings" className="settings-crumb">
              Settings
            </Link>
            <span aria-hidden> / </span>
            Audit
          </p>
          <h1 className="settings-title">Audit log</h1>
          <p className="page-lede">
            Membership, invites, and job-function changes for this Product. Reloading this page
            reads the server — closing a modal does not hide an event.
          </p>
        </div>
        <div className="settings-header-actions">
          <Link href="/settings/members" className="btn btn-ghost">
            Members
          </Link>
          <Link href="/settings" className="btn btn-primary">
            All settings
          </Link>
        </div>
      </header>
      <SettingsLocalNav />

      {error === 'Select or create a Product first.' ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product before reading the audit log.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}

      {error === 'Unauthorized' ? (
        <div className="settings-alert is-error" role="alert">
          <p>
            <Link href="/login?next=/settings/audit">Sign in</Link> to read the audit log.
          </p>
        </div>
      ) : error && error !== 'Select or create a Product first.' ? (
        <div className="settings-alert is-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <p className="page-lede" role="status" aria-live="polite">
          Loading audit log…
        </p>
      ) : null}

      {empty ? (
        <div className="settings-empty" role="status">
          <h2 className="settings-empty-title">No events yet</h2>
          <p className="page-lede">
            When someone is invited, joins, or changes job function, the row shows up here.
          </p>
        </div>
      ) : null}

      {productId && !loading && events.length > 0 ? (
        <ol className="audit-list">
          {events.map((event) => {
            const detail = payloadLine(event.payload)
            return (
              <li key={event.id} className="audit-row">
                <p className="audit-when">{formatWhen(event.createdAt)}</p>
                <div className="audit-body">
                  <p className="audit-action">{actionLabel(event.action)}</p>
                  {detail ? <p className="audit-detail">{detail}</p> : null}
                  <p className="audit-actor">
                    {event.actorUserId ? (
                      <>
                        Actor <span className="mono">{shortId(event.actorUserId)}</span>
                      </>
                    ) : (
                      'System'
                    )}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}
    </section>
  )
}
