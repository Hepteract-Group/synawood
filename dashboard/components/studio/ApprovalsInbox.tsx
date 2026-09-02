'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ApprovalStageTracker } from '@/components/studio/ApprovalStageTracker'
import { StudioSpinner } from '@/components/studio/StudioSpinner'
import { humanizeStudioError } from '@/lib/humanize-studio-error'
import { readActiveProductIdFromDocument } from '@/lib/active-product-cookie'

type ApprovalRun = {
  id: string
  projectId: string
  status: string
  currentStageIndex: number
  stages: Array<{ key: string; label: string; minRole: string }>
  createdAt: string
}

export const ApprovalsInbox = () => {
  const [productId, setProductId] = useState<string | null>(null)
  const [runs, setRuns] = useState<ApprovalRun[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [auditBusy, setAuditBusy] = useState(false)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/studio/approvals?productId=${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      })
      const data = (await res.json().catch(() => ({}))) as {
        runs?: ApprovalRun[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load approvals')
      setRuns(data.runs ?? [])
    } catch (err) {
      setError(humanizeStudioError(err instanceof Error ? err.message : 'Failed to load'))
    } finally {
      setLoading(false)
    }
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
  }, [load])

  const downloadAudit = async (id: string) => {
    setAuditBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/studio/approvals/audit?productId=${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Audit export failed')
      }
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `approval-audit-${id}.csv`
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
    } catch (err) {
      setError(humanizeStudioError(err instanceof Error ? err.message : 'Audit export failed'))
    } finally {
      setAuditBusy(false)
    }
  }

  return (
    <section className="panel approvals-home">
      <p className="eyebrow">Governance</p>
      <h1>Approvals</h1>
      <p className="muted">
        Open multi-stage Approve runs waiting for your sign-off. Reject returns the cut to Studio
        with a revision prompt for the Agent. Owners can download an audit CSV of sign-off events.
      </p>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {!productId ? (
        <p className="muted">
          <Link href="/products">Choose a Product</Link> to see the approvals inbox.
        </p>
      ) : null}

      {productId ? (
        <div className="approvals-toolbar">
          <p className="approvals-product mono">
            Product <strong>{productId}</strong>
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => void load(productId)}>
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={auditBusy}
            onClick={() => void downloadAudit(productId)}
          >
            {auditBusy ? 'Preparing CSV…' : 'Download audit CSV'}
          </button>
        </div>
      ) : null}

      {loading ? <StudioSpinner size="sm" label="Loading" /> : null}

      {!loading && !error && productId && runs.length === 0 ? (
        <div className="approvals-empty">
          <p className="muted">No open approval runs.</p>
          <p className="muted">
            Export a candidate in <Link href="/studio">Studio</Link>, then Approve to start a chain.
          </p>
        </div>
      ) : null}

      {runs.length > 0 ? (
        <ul className="approvals-inbox-list">
          {runs.map((run) => {
            const stage = run.stages[run.currentStageIndex]
            return (
              <li key={run.id} className="approvals-inbox-item">
                <div className="approvals-inbox-copy">
                  <Link className="approvals-inbox-link" href={`/studio/${run.projectId}`}>
                    Open in Studio
                  </Link>
                  <p className="approvals-inbox-meta muted">
                    <span className="mono">{run.projectId.slice(0, 8)}…</span>
                    {' · '}
                    {stage ? `Waiting on ${stage.label}` : 'In progress'}
                    {' · '}
                    {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                <ApprovalStageTracker
                  stages={run.stages}
                  currentStageIndex={run.currentStageIndex}
                  status={run.status}
                />
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
