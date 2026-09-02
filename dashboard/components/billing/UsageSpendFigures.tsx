'use client'

import { useCallback, useEffect, useState } from 'react'
import type { BillingUsage } from '@/app/api/billing/usage/route'
import { formatGbp } from '@/lib/format-gbp'
import { useBillingSummary } from '@/lib/use-billing-summary'

export const UsageSpendFigures = ({
  productId,
  projectId,
}: {
  productId: string | null
  projectId: string | null
}) => {
  const summary = useBillingSummary(productId)
  const [projectGbp, setProjectGbp] = useState(0)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [projectLoading, setProjectLoading] = useState(false)

  const loadProject = useCallback(async () => {
    if (!productId || !projectId) {
      setProjectGbp(0)
      setProjectError(null)
      setProjectLoading(false)
      return
    }
    setProjectLoading(true)
    setProjectError(null)
    try {
      const url = `/api/billing/usage?productId=${encodeURIComponent(productId)}&range=month&projectId=${encodeURIComponent(projectId)}`
      const response = await fetch(url)
      const body = (await response.json().catch(() => null)) as
        (BillingUsage & { error?: string }) | null
      if (!response.ok) {
        throw new Error(body?.error ?? 'Could not load project usage.')
      }
      setProjectGbp(body?.spentGbp ?? 0)
    } catch (err) {
      setProjectGbp(0)
      setProjectError(err instanceof Error ? err.message : 'Could not load project usage.')
    } finally {
      setProjectLoading(false)
    }
  }, [productId, projectId])

  useEffect(() => {
    void loadProject()
  }, [loadProject])

  if (!productId) {
    return <p className="page-lede">Select an organisation to see spend.</p>
  }

  if (summary.loading) {
    return (
      <p className="page-lede" role="status">
        Loading spend figures…
      </p>
    )
  }

  return (
    <div className="usage-spend-block">
      <dl className="usage-spend-figures" aria-label="Spend figures">
        <div>
          <dt>Week</dt>
          <dd className="tabular-nums">{formatGbp(summary.spentThisWeekGbp)}</dd>
        </div>
        <div>
          <dt>Month</dt>
          <dd className="tabular-nums">{formatGbp(summary.spentThisMonthGbp)}</dd>
        </div>
        <div>
          <dt>Project (month)</dt>
          <dd className="tabular-nums">{projectLoading ? '…' : formatGbp(projectGbp)}</dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd className="tabular-nums">{formatGbp(summary.walletBalanceGbp)}</dd>
        </div>
      </dl>
      {projectError ? (
        <p className="error" role="status">
          {projectError}
        </p>
      ) : null}
      {!summary.billingEnabled ? (
        <p className="usage-card-note" role="status">
          Hosted billing is off — figures show £0.
        </p>
      ) : null}
    </div>
  )
}
