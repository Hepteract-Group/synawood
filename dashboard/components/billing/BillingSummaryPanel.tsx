'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatGbp } from '@/lib/format-gbp'
import { useActiveProduct } from '@/lib/use-active-product'
import { useBillingSummary } from '@/lib/use-billing-summary'

const planLabel = (planId: string | null): string => {
  if (planId === 'trial') return 'Trial'
  if (planId === 'studio') return 'Studio'
  if (planId === 'team') return 'Team'
  return planId ?? '—'
}

const trialDaysLeft = (trialEndsAt: string | null): string | null => {
  if (!trialEndsAt) return null
  const ends = Date.parse(trialEndsAt)
  if (!Number.isFinite(ends)) return null
  const days = Math.ceil((ends - Date.now()) / (24 * 60 * 60 * 1000))
  if (days < 0) return 'Trial ended'
  if (days === 0) return 'Trial ends today'
  return `${days} day${days === 1 ? '' : 's'} left on trial`
}

const seatsLine = (used: number | null, limit: number | null): string => {
  if (limit == null && used == null) return ''
  if (limit == null) return ` · ${used ?? '—'} seats`
  return ` · ${used ?? '—'} of ${limit} seats`
}

export const BillingSummaryPanel = () => {
  const { productId, loading: productLoading } = useActiveProduct()
  const summary = useBillingSummary(productId)
  const [upgradeNote, setUpgradeNote] = useState<string | null>(null)

  if (productLoading) return <p className="muted">Loading organisation…</p>
  if (!productId) return <p className="muted">Select an organisation to view billing.</p>
  if (summary.loading) return <p className="muted">Loading billing…</p>

  if (!summary.billingEnabled) {
    return (
      <p className="muted">
        Hosted billing is off. Set BILLING_MODE=on to see plan and wallet here.
      </p>
    )
  }

  const isOwner = summary.role === 'owner'
  const trialLine = trialDaysLeft(summary.trialEndsAt)

  return (
    <div className="settings-card billing-stub-card">
      <div className="billing-stub-row">
        <span className="billing-stub-label">Plan</span>
        <span className="billing-stub-value">
          {planLabel(summary.planId)}
          {seatsLine(summary.seatsUsed, summary.seatLimit)}
        </span>
      </div>
      {trialLine ? (
        <div className="billing-stub-row">
          <span className="billing-stub-label">Trial</span>
          <span className="billing-stub-value">{trialLine}</span>
        </div>
      ) : null}
      <div className="billing-stub-row">
        <span className="billing-stub-label">Wallet</span>
        <span className="billing-stub-value tabular-nums">
          {formatGbp(summary.walletBalanceGbp)}
        </span>
      </div>
      {summary.generationFrozen ? (
        <div className="billing-stub-row">
          <span className="billing-stub-label">Status</span>
          <span className="billing-stub-value auth-error">Generation paused</span>
        </div>
      ) : null}
      <div className="billing-stub-row">
        <span className="billing-stub-label">Legal</span>
        <span className="billing-stub-value">
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </span>
      </div>
      {isOwner ? (
        <div className="billing-actions">
          <button
            type="button"
            className="auth-submit"
            onClick={() =>
              setUpgradeNote(
                'Stripe Checkout is not wired yet. Use /pricing to compare plans, or email us to upgrade.',
              )
            }
          >
            Upgrade
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setUpgradeNote(
                'Customer Portal is not wired yet. Card updates will open here after Stripe is connected.',
              )
            }
          >
            Update payment
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setUpgradeNote(
                'Invoices open in the Customer Portal once Stripe is connected. Nothing to show yet.',
              )
            }
          >
            View invoices
          </button>
        </div>
      ) : (
        <p className="muted">Only owners can upgrade or update payment.</p>
      )}
      {upgradeNote ? (
        <p className="auth-notice" role="status">
          {upgradeNote}{' '}
          <button type="button" className="btn btn-ghost" onClick={() => setUpgradeNote(null)}>
            Dismiss
          </button>
        </p>
      ) : null}
    </div>
  )
}
