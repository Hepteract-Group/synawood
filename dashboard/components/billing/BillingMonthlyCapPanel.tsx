'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { BillingSummary } from '@/app/api/billing/summary/route'
import { useActiveProduct } from '@/lib/use-active-product'

export const BillingMonthlyCapPanel = () => {
  const { productId, loading: productLoading } = useActiveProduct()
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/billing/summary?productId=${encodeURIComponent(id)}`)
    const body = (await response.json().catch(() => null)) as
      (BillingSummary & { error?: string }) | null
    if (!response.ok) {
      setError(body?.error ?? 'Could not load billing summary.')
      setSummary(null)
      return
    }
    setSummary(body)
    setValue(body?.monthlyCapGbp != null ? String(body.monthlyCapGbp) : '')
    setError(null)
  }, [])

  useEffect(() => {
    if (productLoading || !productId) return
    void load(productId)
  }, [load, productId, productLoading])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!productId || !summary) return
    setPending(true)
    setSaved(null)
    setError(null)
    try {
      const monthlyCapGbp = Number(value)
      const response = await fetch('/api/billing/monthly-cap', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, monthlyCapGbp }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        monthlyCapGbp?: number
        maxAllowedGbp?: number
      } | null
      if (!response.ok) {
        setError(body?.error ?? 'Could not save monthly cap.')
        return
      }
      setSaved(
        `Saved £${Number(body?.monthlyCapGbp ?? monthlyCapGbp).toFixed(2)} (max £${Number(body?.maxAllowedGbp ?? 0).toFixed(2)}).`,
      )
      await load(productId)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (productLoading) {
    return <p className="muted">Loading organisation…</p>
  }
  if (!productId) {
    return <p className="muted">Select an organisation to manage the monthly cap.</p>
  }
  if (!summary?.billingEnabled) {
    return (
      <p className="muted">
        Hosted billing is off. Set BILLING_MODE=on to manage the monthly generator cap.
      </p>
    )
  }
  if (!summary.hasWallet) {
    return <p className="muted">No wallet yet for this organisation.</p>
  }

  const maxAllowed = summary.maxAllowedCapGbp ?? 0
  const isOwner = summary.role === 'owner'

  return (
    <form className="billing-cap-form" onSubmit={(event) => void onSubmit(event)}>
      <h2 className="settings-subheading">Monthly generator cap</h2>
      <p className="muted">
        Cap cannot exceed £{maxAllowed.toFixed(2)} (wallet £{summary.walletBalanceGbp.toFixed(2)} +
        £{summary.spentThisPeriodFromWalletGbp.toFixed(2)} already spent this period).
      </p>
      <label className="billing-cap-label">
        Cap (£)
        <input
          type="number"
          min={0}
          step="0.01"
          max={maxAllowed}
          value={value}
          disabled={!isOwner || pending}
          onChange={(event) => {
            setSaved(null)
            const raw = event.target.value
            const parsed = Number(raw)
            if (raw !== '' && Number.isFinite(parsed) && parsed > maxAllowed) {
              setValue(String(maxAllowed))
              return
            }
            setValue(raw)
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'billing-cap-error' : 'billing-cap-hint'}
        />
      </label>
      <p id="billing-cap-hint" className="muted">
        {isOwner
          ? 'Owners can raise or lower this cap within prepaid headroom.'
          : 'Only owners can change the cap.'}
      </p>
      {error ? (
        <p id="billing-cap-error" className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="auth-notice" role="status">
          {saved}
        </p>
      ) : null}
      {isOwner ? (
        <button type="submit" className="auth-submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save cap'}
        </button>
      ) : null}
    </form>
  )
}
