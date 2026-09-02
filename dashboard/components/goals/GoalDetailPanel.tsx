'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { StudioSpinner } from '@/components/studio/StudioSpinner'
import { readActiveProductIdFromDocument } from '../../lib/active-product-cookie'

type GoalDetail = {
  id: string
  title: string
  outcome: string
  successMetric: string
  status: string
}

type PlanRow = { id: string; title: string; summary: string; status: string }
type ActionRow = {
  id: string
  title: string
  actionType: string
  status: string
  requiresApproval: boolean
}

type Retrospective = {
  insight: string
  totals: {
    plans: number
    actions: number
    done: number
    failed: number
    killed: number
    awaitingApproval: number
  }
}

export const GoalDetailPanel = ({ goalId }: { goalId: string }) => {
  const [productId, setProductId] = useState<string | null>(null)
  const [goal, setGoal] = useState<GoalDetail | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [actionsByPlan, setActionsByPlan] = useState<Record<string, ActionRow[]>>({})
  const [retrospective, setRetrospective] = useState<Retrospective | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    async (id: string) => {
      const [detailResponse, retroResponse] = await Promise.all([
        fetch(
          `/api/studio/goals/${encodeURIComponent(goalId)}?productId=${encodeURIComponent(id)}`,
        ),
        fetch(
          `/api/studio/goals/${encodeURIComponent(goalId)}/retrospective?productId=${encodeURIComponent(id)}`,
        ),
      ])
      const body = (await detailResponse.json().catch(() => null)) as {
        goal?: GoalDetail
        plans?: PlanRow[]
        actionsByPlan?: Record<string, ActionRow[]>
        error?: string
      } | null
      if (!detailResponse.ok) throw new Error(body?.error ?? 'Could not load goal.')
      setGoal(body?.goal ?? null)
      setPlans(body?.plans ?? [])
      setActionsByPlan(body?.actionsByPlan ?? {})

      const retroBody = (await retroResponse.json().catch(() => null)) as {
        retrospective?: Retrospective
      } | null
      if (retroResponse.ok) setRetrospective(retroBody?.retrospective ?? null)
    },
    [goalId],
  )

  useEffect(() => {
    const id = readActiveProductIdFromDocument()
    setProductId(id)
    if (!id) {
      setLoading(false)
      setError('Select a Product first.')
      return
    }
    void load(id)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load goal.'))
      .finally(() => setLoading(false))
  }, [load])

  const refresh = async () => {
    if (!productId) return
    setError(null)
    await load(productId)
  }

  const onPlan = async () => {
    if (!productId) return
    setBusy('plan')
    setNotice(null)
    try {
      const response = await fetch(`/api/studio/goals/${encodeURIComponent(goalId)}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Plan failed.')
      setNotice('Plan proposed. Approve actions below before dispatch.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan failed.')
    } finally {
      setBusy(null)
    }
  }

  const onLifecycle = async (status: 'active' | 'paused' | 'killed' | 'completed') => {
    if (!productId) return
    setBusy(`life-${status}`)
    try {
      const response = await fetch(`/api/studio/goals/${encodeURIComponent(goalId)}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, status }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Lifecycle update failed.')
      setNotice(`Goal marked ${status}.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lifecycle update failed.')
    } finally {
      setBusy(null)
    }
  }

  const onReview = async (actionId: string, approve: boolean, dispatchAfter: boolean) => {
    if (!productId) return
    setBusy(actionId)
    try {
      const response = await fetch(
        `/api/studio/goals/actions/${encodeURIComponent(actionId)}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, approve, dispatch: dispatchAfter }),
        },
      )
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Review failed.')
      setNotice(approve ? 'Action approved.' : 'Action rejected.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed.')
    } finally {
      setBusy(null)
    }
  }

  const onDispatch = async (actionId: string) => {
    if (!productId) return
    setBusy(actionId)
    try {
      const response = await fetch(
        `/api/studio/goals/actions/${encodeURIComponent(actionId)}/dispatch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        },
      )
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error ?? 'Dispatch failed.')
      setNotice('Action dispatched.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="panel goal-detail">
      <p className="eyebrow">
        <Link href="/goals">Goals</Link>
      </p>
      {loading ? <StudioSpinner size="sm" label="Loading" /> : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="auth-notice" role="status">
          {notice}
        </p>
      ) : null}
      {goal ? (
        <>
          <h1>{goal.title}</h1>
          <p className="muted">
            {goal.status}
            {goal.successMetric ? ` · ${goal.successMetric}` : ''}
          </p>
          {goal.outcome ? <p>{goal.outcome}</p> : null}

          {retrospective ? (
            <div className="goals-progress" aria-live="polite">
              <h2>Progress</h2>
              <p>{retrospective.insight}</p>
              <p className="muted">
                {retrospective.totals.done}/{retrospective.totals.actions} done ·{' '}
                {retrospective.totals.awaitingApproval} awaiting approval ·{' '}
                {retrospective.totals.failed} failed · {retrospective.totals.killed} killed
              </p>
            </div>
          ) : null}

          <div className="goals-toolbar">
            <button type="button" disabled={busy === 'plan'} onClick={() => void onPlan()}>
              {busy === 'plan' ? 'Planning…' : 'Propose plan'}
            </button>
            {goal.status !== 'paused' ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void onLifecycle('paused')}
              >
                Pause
              </button>
            ) : (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void onLifecycle('active')}
              >
                Resume
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(busy) || goal.status === 'killed'}
              onClick={() => void onLifecycle('killed')}
            >
              Kill
            </button>
          </div>

          {plans.length === 0 ? (
            <p className="muted">
              No plans yet. Use Propose plan (or Studio Agent `plan_campaign` with the
              marketing-strategist skill).
            </p>
          ) : (
            <ul className="goals-plans">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <h2>{plan.title}</h2>
                  <p className="muted">{plan.status}</p>
                  {plan.summary ? <p>{plan.summary}</p> : null}
                  <ul className="goals-actions">
                    {(actionsByPlan[plan.id] ?? []).map((action) => (
                      <li key={action.id} className="goals-action-row">
                        <div>
                          <span>{action.title}</span>
                          <span className="muted">
                            {' '}
                            · {action.actionType} · {action.status}
                          </span>
                        </div>
                        <div className="packs-row-actions">
                          {action.status === 'awaiting_approval' || action.status === 'proposed' ? (
                            <>
                              <button
                                type="button"
                                disabled={busy === action.id}
                                onClick={() => void onReview(action.id, true, false)}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busy === action.id}
                                onClick={() => void onReview(action.id, true, true)}
                              >
                                Approve + run
                              </button>
                              <button
                                type="button"
                                disabled={busy === action.id}
                                onClick={() => void onReview(action.id, false, false)}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {action.status === 'approved' ? (
                            <button
                              type="button"
                              disabled={busy === action.id}
                              onClick={() => void onDispatch(action.id)}
                            >
                              Run
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  )
}
