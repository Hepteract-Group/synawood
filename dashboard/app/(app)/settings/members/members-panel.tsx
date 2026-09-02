'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { readActiveProductIdFromDocument } from '../../../../lib/active-product-cookie'
import { useActiveProduct } from '../../../../lib/use-active-product'
import {
  FUNCTIONAL_ROLE_HINT,
  FUNCTIONAL_ROLE_LABEL,
  FUNCTIONAL_ROLES,
  INVITE_FUNCTIONAL_ROLES,
  isFunctionalRole,
  isInviteFunctionalRole,
  tenancyForInviteFunctionalRole,
  type FunctionalRole,
  type InviteFunctionalRole,
} from '../../../../lib/functional-roles'
import { planIncludesRole, type ProductPlan } from '../../../../lib/plan-flags'
import { readApiJson } from '../../../../lib/read-api-json'
import { SettingsLocalNav } from '../settings-local-nav'
import {
  effectiveSeatLimit,
  inviteWithinSeatLimit,
  seatCapRejectCopy,
} from '@synawood/creative/billing/seat-cap'

const SELECT_ORGANIZATION_ERROR = 'Select or create an organization first.'

type ProductRole = 'owner' | 'editor' | 'viewer'

type MemberRow = {
  userId: string
  email: string
  displayName: string
  unresolved?: boolean
  role: ProductRole | string
  functionalRole?: string
  createdAt: string
}

type InviteRow = {
  id: string
  email: string
  role: string
  functionalRole?: string
  token: string
  expiresAt: string | null
  acceptedAt: string | null
  pending: boolean
}

type InviteNotice = {
  email: string
  link: string
  job: string
}

const roleLabel = (role: string): string => {
  switch (role) {
    case 'owner':
      return 'Owner'
    case 'editor':
      return 'Editor'
    case 'viewer':
      return 'Viewer'
    default:
      return role
  }
}

const jobLabel = (role: string | undefined): string =>
  isFunctionalRole(role) ? FUNCTIONAL_ROLE_LABEL[role] : 'Unknown'

const initialFromName = (name: string): string => {
  const trimmed = name.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?'
}

const formatJoined = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const formatExpiry = (iso: string | null): string => {
  if (!iso) return 'No expiry'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No expiry'
  return `Expires ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)}`
}

export const MembersPanel = () => {
  const emailId = useId()
  const jobId = useId()
  const errorId = useId()
  const noticeId = useId()
  const { productName } = useActiveProduct()
  const orgLabel = productName?.trim() || 'this organization'

  const [productId, setProductId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [canManageMembers, setCanManageMembers] = useState(false)
  const [email, setEmail] = useState('')
  const [jobFunction, setJobFunction] = useState<InviteFunctionalRole>('editor')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<InviteNotice | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [changingUserId, setChangingUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<ProductPlan>('founding')
  const [seatLimit, setSeatLimit] = useState<number | null>(null)
  const [seatsOccupied, setSeatsOccupied] = useState(0)
  const [billingPlanId, setBillingPlanId] = useState<string | null>(null)
  const [seatsLine, setSeatsLine] = useState<string | null>(null)

  const pendingInvites = useMemo(() => invites.filter((invite) => invite.pending), [invites])
  const atSeatCap = useMemo(() => {
    if (seatLimit == null) return false
    return !inviteWithinSeatLimit({ occupied: seatsOccupied, seatLimit })
  }, [seatLimit, seatsOccupied])
  const seatCapMessage = useMemo(
    () =>
      atSeatCap && seatLimit != null
        ? seatCapRejectCopy(billingPlanId, effectiveSeatLimit(seatLimit))
        : null,
    [atSeatCap, billingPlanId, seatLimit],
  )

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}/members`)
    const body = await readApiJson<{
      members?: MemberRow[]
      invites?: InviteRow[]
      canManageMembers?: boolean
      seatLimit?: number
      seatsOccupied?: number
      planId?: string | null
      seatsLine?: string
      error?: string
    }>(response)
    if (!response.ok) {
      throw new Error(body.error ?? 'Could not load members.')
    }
    setMembers(body.members ?? [])
    setInvites(body.invites ?? [])
    setCanManageMembers(Boolean(body.canManageMembers))
    setSeatLimit(body.seatLimit ?? null)
    setSeatsOccupied(body.seatsOccupied ?? 0)
    setBillingPlanId(body.planId ?? null)
    setSeatsLine(body.seatsLine ?? null)
  }, [])

  useEffect(() => {
    const id = readActiveProductIdFromDocument()
    setProductId(id)
    void (async () => {
      const response = await fetch('/api/plan-flags')
      const body = await readApiJson<{ plan?: ProductPlan }>(response)
      if (response.ok && body.plan) setPlan(body.plan)
    })()
    if (!id) {
      setLoading(false)
      setError(SELECT_ORGANIZATION_ERROR)
      return
    }
    void load(id)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load members.'))
      .finally(() => setLoading(false))
  }, [load])

  const onInvite = async (event: FormEvent) => {
    event.preventDefault()
    if (!productId || pending) return
    setError(null)
    setNotice(null)
    setCopied(false)
    setPending(true)
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: tenancyForInviteFunctionalRole(jobFunction),
          functionalRole: jobFunction,
        }),
      })
      const body = await readApiJson<{
        invite?: { acceptPath: string; email: string; functionalRole?: string }
        error?: string
      }>(response)
      if (!response.ok || !body.invite) {
        throw new Error(body.error ?? 'Could not create invite.')
      }
      const absolute = `${window.location.origin}${body.invite.acceptPath}`
      setNotice({
        email: body.invite.email,
        link: absolute,
        job: jobLabel(body.invite.functionalRole ?? jobFunction),
      })
      setEmail('')
      await load(productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPending(false)
    }
  }

  const onCopyLink = async () => {
    if (!notice) return
    try {
      await navigator.clipboard.writeText(notice.link)
      setCopied(true)
    } catch {
      setError('Could not copy the invite link. Select it and copy manually.')
    }
  }

  const onRevoke = async (inviteId: string) => {
    if (!productId || revokingId) return
    setError(null)
    setRevokingId(inviteId)
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/invites/${encodeURIComponent(inviteId)}`,
        { method: 'DELETE' },
      )
      const body = await readApiJson<{ error?: string }>(response)
      if (!response.ok) {
        throw new Error(body.error ?? 'Could not revoke invite.')
      }
      await load(productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRevokingId(null)
    }
  }

  const onChangeJob = async (userId: string, next: FunctionalRole) => {
    if (!productId || changingUserId) return
    setError(null)
    setNotice(null)
    setChangingUserId(userId)
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/members/${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionalRole: next }),
        },
      )
      const body = await readApiJson<{ error?: string }>(response)
      if (!response.ok) {
        throw new Error(body.error ?? 'Could not update job function.')
      }
      await load(productId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setChangingUserId(null)
    }
  }

  const noProduct = !productId && !loading
  const productError = error === SELECT_ORGANIZATION_ERROR

  return (
    <section className="panel settings-page mos-enter">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">
            <Link href="/settings" className="settings-crumb">
              Settings
            </Link>
            <span aria-hidden> / </span>
            Members
          </p>
          <h1 className="settings-title" data-guide="members-heading">
            Members
          </h1>
          <p className="page-lede">
            People in {orgLabel}. Invite by job function. Who can open the workspace is still owner
            / editor / viewer. See what each job can do on <Link href="/settings/roles">Roles</Link>
            .
          </p>
        </div>
        <div className="settings-header-actions">
          <Link href="/settings" className="btn btn-ghost">
            All settings
          </Link>
          <Link href="/products" className="btn btn-primary">
            Organizations
          </Link>
        </div>
      </header>
      <SettingsLocalNav />

      {notice ? (
        <div className="members-status" role="status" aria-live="polite" id={noticeId}>
          <div className="members-status-copy">
            <p className="members-status-title">
              Invite ready for {notice.email} as {notice.job}
            </p>
            <p className="members-status-link" translate="no">
              {notice.link}
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void onCopyLink()}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      ) : null}

      {noProduct ? (
        <div className="settings-empty" role="alert">
          <h2 className="settings-empty-title">No organization selected</h2>
          <p className="page-lede">Choose an organization to see names and emails on the team.</p>
          <Link href="/products" className="btn btn-primary">
            Your organizations
          </Link>
          <Link href="/onboarding" className="btn btn-ghost">
            Create an organization
          </Link>
        </div>
      ) : null}

      {loading ? (
        <p className="page-lede" role="status" aria-live="polite">
          Loading members…
        </p>
      ) : null}

      {error === 'Unauthorized' ? (
        <div className="settings-alert is-error" role="alert" id={errorId}>
          <p>
            <Link href="/login?next=/settings/members">Sign in</Link> to manage members.
          </p>
        </div>
      ) : error && !productError ? (
        <div className="settings-alert is-error" role="alert" id={errorId}>
          <p>{error}</p>
        </div>
      ) : null}

      {productId && !loading ? (
        <div className="members-layout mos-stagger">
          <section className="members-card" aria-labelledby="members-list-heading">
            <div className="members-card-head">
              <div>
                <h2 id="members-list-heading" className="members-card-title">
                  Current members
                </h2>
                {seatsLine ? (
                  <p className="muted" role="status">
                    {seatsLine}
                  </p>
                ) : null}
                <p className="members-card-note">
                  {members.length === 0
                    ? 'No members loaded yet.'
                    : `${members.length} ${members.length === 1 ? 'person' : 'people'} in ${orgLabel}.`}
                </p>
              </div>
            </div>

            {members.length === 0 ? (
              <p className="page-lede">No members to show.</p>
            ) : (
              <ul className="members-people">
                {members.map((person) => {
                  const job = isFunctionalRole(person.functionalRole)
                    ? person.functionalRole
                    : undefined
                  const joined = formatJoined(person.createdAt)
                  const jobSelectId = `job-${person.userId}`
                  return (
                    <li key={person.userId} className="members-person">
                      <span className="members-person-mark" aria-hidden>
                        {initialFromName(person.displayName)}
                      </span>
                      <div className="members-person-body">
                        <p className="members-person-name">{person.displayName || 'Member'}</p>
                        {person.unresolved ? (
                          <p className="members-person-email" role="status">
                            Couldn’t load this person’s name or email.
                          </p>
                        ) : (
                          <p className="members-person-email" translate="no">
                            {person.email || 'Unknown email'}
                          </p>
                        )}
                        <p className="members-person-meta">
                          <span className={`members-role members-role-${person.role}`}>
                            {roleLabel(person.role)}
                          </span>
                          {joined ? (
                            <>
                              <span aria-hidden> · </span>
                              <span>Joined {joined}</span>
                            </>
                          ) : null}
                        </p>
                        {canManageMembers && job ? (
                          <label className="members-job-field" htmlFor={jobSelectId}>
                            <span>Job function</span>
                            <select
                              id={jobSelectId}
                              value={job}
                              disabled={changingUserId === person.userId}
                              onChange={(event) => {
                                const next = event.target.value
                                if (isFunctionalRole(next)) void onChangeJob(person.userId, next)
                              }}
                            >
                              {FUNCTIONAL_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {FUNCTIONAL_ROLE_LABEL[role]}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <>
                            <p className="members-person-job">
                              Job function: <strong>{jobLabel(job)}</strong>
                            </p>
                            {job ? (
                              <p className="members-person-hint">{FUNCTIONAL_ROLE_HINT[job]}</p>
                            ) : null}
                          </>
                        )}
                        {canManageMembers && job ? (
                          <p className="members-person-hint">{FUNCTIONAL_ROLE_HINT[job]}</p>
                        ) : null}
                        {changingUserId === person.userId ? (
                          <p className="members-person-hint" role="status">
                            Saving job function…
                          </p>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="members-card members-card-invite" aria-labelledby="invite-heading">
            <div className="members-card-head">
              <div>
                <h2 id="invite-heading" className="members-card-title">
                  Invite someone
                </h2>
                <p className="members-card-note">
                  Creates a link you can send. Only owners can invite.
                </p>
              </div>
            </div>

            {seatCapMessage ? (
              <p className="members-card-note" role="status">
                {seatCapMessage}
              </p>
            ) : null}

            <form
              onSubmit={onInvite}
              className="members-invite-form"
              aria-busy={pending}
              aria-describedby={error && !productError ? errorId : undefined}
            >
              <label className="members-field" htmlFor={emailId}>
                <span>Email</span>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  spellCheck={false}
                  inputMode="email"
                  placeholder="teammate@company.com"
                  value={email}
                  disabled={pending || !canManageMembers || atSeatCap}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(error) && !productError}
                />
              </label>
              <label className="members-field" htmlFor={jobId}>
                <span>Job function</span>
                <select
                  id={jobId}
                  name="functionalRole"
                  value={jobFunction}
                  disabled={pending || !canManageMembers || atSeatCap}
                  onChange={(event) => {
                    const next = event.target.value
                    if (isInviteFunctionalRole(next)) setJobFunction(next)
                  }}
                >
                  {INVITE_FUNCTIONAL_ROLES.map((role) => {
                    const included = planIncludesRole(plan, role)
                    return (
                      <option key={role} value={role} disabled={!included}>
                        {FUNCTIONAL_ROLE_LABEL[role]} —{' '}
                        {included ? FUNCTIONAL_ROLE_HINT[role] : 'not on this plan'}
                      </option>
                    )
                  })}
                </select>
              </label>
              <button
                type="submit"
                className="btn btn-primary members-invite-submit"
                disabled={pending || !canManageMembers || atSeatCap}
              >
                {pending ? 'Creating invite…' : 'Create invite'}
              </button>
            </form>
          </section>

          <section className="members-card members-card-pending" aria-labelledby="pending-heading">
            <div className="members-card-head">
              <div>
                <h2 id="pending-heading" className="members-card-title">
                  Pending invites
                </h2>
                <p className="members-card-note">
                  {pendingInvites.length === 0
                    ? 'No open invites right now.'
                    : `${pendingInvites.length} waiting to be accepted.`}
                </p>
              </div>
            </div>

            {pendingInvites.length === 0 ? (
              <div className="members-pending-empty">
                <p className="page-lede">
                  When you create an invite, it shows up here until they accept or you revoke it.
                </p>
              </div>
            ) : (
              <ul className="members-people">
                {pendingInvites.map((invite) => (
                  <li key={invite.id} className="members-person members-person-invite">
                    <span className="members-person-mark members-person-mark-invite" aria-hidden>
                      @
                    </span>
                    <div className="members-person-body">
                      <p className="members-person-id" translate="no">
                        {invite.email}
                      </p>
                      <p className="members-person-meta">
                        <span
                          className={`members-role members-role-${invite.functionalRole ?? invite.role}`}
                        >
                          {jobLabel(invite.functionalRole)}
                        </span>
                        <span aria-hidden> · </span>
                        <span>{formatExpiry(invite.expiresAt)}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost members-revoke"
                      disabled={!canManageMembers || revokingId === invite.id}
                      onClick={() => void onRevoke(invite.id)}
                      aria-label={`Revoke invite for ${invite.email}`}
                    >
                      {revokingId === invite.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </section>
  )
}
