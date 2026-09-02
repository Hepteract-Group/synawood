'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import {
  CreateProductForm,
  type CreatedProduct,
} from '../../../components/products/CreateProductForm'
import {
  FUNCTIONAL_ROLE_LABEL,
  INVITE_FUNCTIONAL_ROLES,
  isInviteFunctionalRole,
  tenancyForInviteFunctionalRole,
  type InviteFunctionalRole,
} from '../../../lib/functional-roles'
import { PRODUCT_MARK, PRODUCT_NAME } from '../../../lib/product-name'
import {
  emptyInviteDraft,
  MAX_ONBOARDING_INVITES,
  partitionInviteDrafts,
  type OnboardingInviteDraft,
} from '../../../lib/onboarding-invites'

const sendInvite = async (productId: string, row: OnboardingInviteDraft): Promise<void> => {
  const response = await fetch(`/api/products/${encodeURIComponent(productId)}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: row.email,
      role: tenancyForInviteFunctionalRole(row.jobFunction),
      functionalRole: row.jobFunction,
    }),
  })
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    throw new Error(body?.error ?? row.email)
  }
}

export const OrganizationOnboardingForm = () => {
  const inviteId = useId()
  const [inviteToken, setInviteToken] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [rows, setRows] = useState<OnboardingInviteDraft[]>([emptyInviteDraft()])
  const [banner, setBanner] = useState<string | null>(null)

  const onJoinInvite = () => {
    setInviteError(null)
    const token = inviteToken.trim().replace(/^.*\/invite\//, '')
    if (!token) {
      setInviteError('Paste an invite link or token from an owner.')
      return
    }
    window.location.assign(`/invite/${encodeURIComponent(token)}`)
  }

  const onCreated = async (product: CreatedProduct) => {
    const { valid, invalid } = partitionInviteDrafts(rows)
    const failed: string[] = invalid.map((row) => row.email)
    for (const row of valid) {
      try {
        await sendInvite(product.id, row)
      } catch {
        failed.push(row.email)
      }
    }
    if (failed.length === 0) {
      window.location.assign('/settings/members')
      return
    }
    setBanner(
      `Organization created. Could not invite: ${failed.join(', ')}. You can invite them in Settings → Members.`,
    )
  }

  return (
    <div className="auth-shell">
      <a href="#auth-main" className="skip-link">
        Skip to organization setup
      </a>
      <Link href="/" className="auth-brand">
        <span className="auth-brand-mark" aria-hidden>
          {PRODUCT_MARK}
        </span>
        <span>{PRODUCT_NAME}</span>
      </Link>
      <section id="auth-main" className="auth-panel auth-panel-wide" aria-labelledby="org-title">
        <p className="auth-step">Step 2 of 2</p>
        <h1 id="org-title">Your organization</h1>
        <p className="auth-lede">
          Your team’s {PRODUCT_NAME}. Studio, brand, and members live here.
        </p>
        {banner ? (
          <p className="auth-notice" role="status">
            {banner} <Link href="/settings/members">Open Members</Link>
          </p>
        ) : null}
        <CreateProductForm
          slugLabel="URL slug"
          slugHint="Lowercase letters, numbers, and hyphens — not a website address (e.g. hepteract-group)."
          onCreated={(product) => void onCreated(product)}
        >
          <div className="org-invites">
            <p className="org-invites-title">Invite teammates (optional)</p>
            {rows.map((row, index) => (
              <div key={index} className="org-invite-row">
                <label>
                  Email
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="teammate@company.com"
                    value={row.email}
                    onChange={(event) => {
                      const next = [...rows]
                      next[index] = { ...row, email: event.target.value }
                      setRows(next)
                    }}
                  />
                </label>
                <label>
                  Job function
                  <select
                    name="functionalRole"
                    value={row.jobFunction}
                    onChange={(event) => {
                      const value = event.target.value
                      if (!isInviteFunctionalRole(value)) return
                      const next = [...rows]
                      next[index] = { ...row, jobFunction: value as InviteFunctionalRole }
                      setRows(next)
                    }}
                  >
                    {INVITE_FUNCTIONAL_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {FUNCTIONAL_ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                </label>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    className="auth-text-btn"
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="auth-text-btn"
              disabled={rows.length >= MAX_ONBOARDING_INVITES}
              onClick={() => {
                if (rows.length >= MAX_ONBOARDING_INVITES) return
                setRows([...rows, emptyInviteDraft()])
              }}
            >
              Add another
            </button>
            {rows.length >= MAX_ONBOARDING_INVITES ? (
              <p className="auth-field-hint">
                You can invite up to five people now. Add more later in Settings → Members.
              </p>
            ) : (
              <p className="auth-field-hint">You can invite more anytime in Settings → Members.</p>
            )}
          </div>
        </CreateProductForm>
        <div className="auth-or" role="separator" aria-label="or">
          <span>Have an invite?</span>
        </div>
        <div className="auth-form">
          <label htmlFor={inviteId}>
            Invite link or token
            <input
              id={inviteId}
              placeholder="Paste invite URL or token"
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
            />
          </label>
          {inviteError ? (
            <p className="auth-error" role="alert">
              {inviteError}
            </p>
          ) : null}
          <button type="button" className="auth-google" onClick={onJoinInvite}>
            Continue with invite
          </button>
        </div>
      </section>
    </div>
  )
}
