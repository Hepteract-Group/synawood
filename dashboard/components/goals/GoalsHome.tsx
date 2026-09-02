'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readActiveProductIdFromDocument } from '../../lib/active-product-cookie'

type GoalRow = {
  id: string
  title: string
  outcome: string
  successMetric: string
  status: string
  createdAt: string
}

const statusLabel = (status: string): string => {
  switch (status) {
    case 'active':
      return 'Active'
    case 'paused':
      return 'Paused'
    case 'killed':
      return 'Stopped'
    default:
      return status
  }
}

export const GoalsHome = () => {
  const router = useRouter()
  const titleId = useId()
  const outcomeId = useId()
  const metricId = useId()
  const errorId = useId()
  const [productId, setProductId] = useState<string | null>(null)
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [title, setTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [successMetric, setSuccessMetric] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (id: string) => {
    const response = await fetch(`/api/studio/goals?productId=${encodeURIComponent(id)}`)
    const body = (await response.json().catch(() => null)) as {
      goals?: GoalRow[]
      error?: string
    } | null
    if (!response.ok) throw new Error(body?.error ?? 'Could not load goals.')
    setGoals(body?.goals ?? [])
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load goals.'))
      .finally(() => setLoading(false))
  }, [load])

  const onCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!productId || pending) return
    if (!title.trim()) {
      setError('Give the goal a title before creating it.')
      return
    }
    setPending(true)
    setError(null)
    setBanner('Creating goal…')
    try {
      const response = await fetch('/api/studio/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          title: title.trim(),
          outcome: outcome.trim(),
          successMetric: successMetric.trim(),
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        goal?: GoalRow
        error?: string
      } | null
      if (!response.ok || !body?.goal) throw new Error(body?.error ?? 'Could not create goal.')
      setTitle('')
      setOutcome('')
      setSuccessMetric('')
      setBanner(null)
      router.push(`/goals/${body.goal.id}`)
    } catch (err) {
      setBanner(null)
      setError(err instanceof Error ? err.message : 'Could not create goal.')
    } finally {
      setPending(false)
    }
  }

  const productError = error === 'Select or create a Product first.'

  return (
    <section className="panel goals-home mos-enter">
      <div className="goals-home-stage">
        <header className="goals-home-header">
          <p className="eyebrow">Goals</p>
          <h1 className="goals-home-title">Campaign goals</h1>
          <p className="page-lede">
            Name an outcome. Plans and actions stay human-gated — nothing spends or publishes
            without approval.
          </p>
        </header>

        {banner ? (
          <div className="goals-banner" role="status" aria-live="polite">
            {banner}
          </div>
        ) : null}

        {error === 'Unauthorized' ? (
          <div className="goals-home-alert" role="alert" id={errorId}>
            <p>
              <Link href="/login?next=/goals">Sign in</Link> to manage goals.
            </p>
          </div>
        ) : error && !productError ? (
          <p className="error goals-home-error" role="alert" id={errorId}>
            {error}
          </p>
        ) : null}

        {productError || !productId ? (
          <div className="goals-home-empty" role="alert">
            <h2 className="goals-home-empty-title">No active Product</h2>
            <p className="page-lede">Choose a Product before creating a goal.</p>
            <Link href="/products" className="btn btn-primary">
              Open Products
            </Link>
          </div>
        ) : null}

        {productId ? (
          <form
            className="goals-composer"
            onSubmit={(event) => void onCreate(event)}
            aria-busy={pending}
            aria-describedby={error && !productError ? errorId : undefined}
          >
            <label className="goals-field" htmlFor={titleId}>
              <span>Title</span>
              <input
                id={titleId}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={200}
                placeholder="Ship 3 Finals this week"
                disabled={pending}
                autoComplete="off"
              />
            </label>
            <label className="goals-field" htmlFor={outcomeId}>
              <span>Outcome</span>
              <textarea
                id={outcomeId}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                rows={4}
                placeholder="What does success look like?"
                disabled={pending}
              />
            </label>
            <label className="goals-field" htmlFor={metricId}>
              <span>Success metric</span>
              <input
                id={metricId}
                value={successMetric}
                onChange={(event) => setSuccessMetric(event.target.value)}
                maxLength={500}
                placeholder="3 approved Finals"
                disabled={pending}
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary goals-composer-submit"
              disabled={pending || !title.trim()}
            >
              {pending ? 'Working…' : 'Create goal'}
            </button>
          </form>
        ) : null}

        {loading ? (
          <p className="page-lede goals-home-loading" role="status" aria-live="polite">
            Loading goals…
          </p>
        ) : null}

        {productId && !loading ? (
          <section className="goals-recent" aria-labelledby="goals-recent-title">
            <h2 id="goals-recent-title" className="goals-section-title">
              Recent goals
            </h2>
            {goals.length === 0 ? (
              <p className="muted">No goals yet. The first one you create shows up here.</p>
            ) : (
              <ul className="goals-list">
                {goals.map((goal) => (
                  <li key={goal.id}>
                    <Link href={`/goals/${goal.id}`} className="goals-list-link">
                      <span className="goals-list-title">{goal.title}</span>
                      <span className="goals-list-meta">
                        {statusLabel(goal.status)}
                        {goal.successMetric ? ` · ${goal.successMetric}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </section>
  )
}
