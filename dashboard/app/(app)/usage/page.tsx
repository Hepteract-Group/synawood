'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { UsageSpendFigures } from '@/components/billing/UsageSpendFigures'
import { SpendScopeSelect } from '@/components/dashboard/SpendScopeSelect'
import { ToolTrace, type TraceEntry } from '@/components/studio/ToolTrace'
import { readApiJson } from '@/lib/read-api-json'
import { resolveClientProductId } from '@/lib/resolve-client-product-id'
import { useActiveProduct } from '@/lib/use-active-product'

type UsageProject = {
  id: string
  headline: string
}

/** Usage: £ figures + Studio tool traces (docs/ui/billing.md §4). */
const UsagePageInner = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const projectIdFromUrl = searchParams.get('projectId')
  const { productId: activeProductId } = useActiveProduct()

  const [projects, setProjects] = useState<UsageProject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [entries, setEntries] = useState<TraceEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tracesLoading, setTracesLoading] = useState(false)

  const replaceProjectId = (nextId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextId) params.set('projectId', nextId)
    else params.delete('projectId')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const productId = resolveClientProductId()
        if (!productId) {
          throw new Error('Select a Product first.')
        }
        const response = await fetch(
          `/api/studio/projects?productId=${encodeURIComponent(productId)}`,
        )
        const body = await readApiJson<{
          projects?: Array<{ id: string; headline: string }>
          error?: string
        }>(response)
        if (!response.ok) throw new Error(body.error ?? 'Failed to load projects')
        if (cancelled) return
        const list = (body.projects ?? []).map((item) => ({
          id: item.id,
          headline: item.headline,
        }))
        setProjects(list)
        const urlId =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('projectId')
            : null
        const nextId = list.find((item) => item.id === urlId)?.id ?? list[0]?.id ?? null
        setSelectedId(nextId)
        if (nextId && nextId !== urlId) {
          const params = new URLSearchParams(window.location.search)
          params.set('projectId', nextId)
          router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load projects')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname, router])

  useEffect(() => {
    if (!projectIdFromUrl || projects.length === 0) return
    if (!projects.some((item) => item.id === projectIdFromUrl)) return
    if (projectIdFromUrl === selectedId) return
    setSelectedId(projectIdFromUrl)
  }, [projectIdFromUrl, projects, selectedId])

  useEffect(() => {
    if (!selectedId) {
      setEntries([])
      return
    }
    let cancelled = false
    void (async () => {
      setTracesLoading(true)
      try {
        const response = await fetch(`/api/studio/chat?projectId=${selectedId}`)
        if (!response.ok) {
          if (!cancelled) setEntries([])
          return
        }
        const body = await readApiJson<{ toolTrace?: TraceEntry[] }>(response)
        if (!cancelled) setEntries(body.toolTrace ?? [])
      } catch {
        if (!cancelled) setEntries([])
      } finally {
        if (!cancelled) setTracesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.headline,
        mark: (project.headline.trim().charAt(0) || '?').toUpperCase(),
        meta: 'Studio project',
      })),
    [projects],
  )

  const failedCount = entries.filter((entry) => !entry.outcome.ok).length
  const selectedProject = projects.find((project) => project.id === selectedId) ?? null

  return (
    <section className="panel usage-page mos-enter">
      <header className="usage-header">
        <div className="usage-header-copy">
          <p className="eyebrow">Usage</p>
          <h1 className="usage-title">Usage</h1>
          <p className="page-lede">
            Week, month, and project spend in pounds, plus Studio tool traces.
          </p>
        </div>
        <div className="usage-header-actions">
          <Link href="/settings/billing" className="btn btn-ghost">
            Billing
          </Link>
          <Link href="/studio" className="btn btn-primary">
            Studio
          </Link>
        </div>
      </header>

      <div className="usage-spend-scope mos-stagger">
        {projects.length > 0 ? (
          <SpendScopeSelect
            label="Project"
            value={selectedId ?? projects[0]?.id ?? ''}
            options={projectOptions}
            onChange={(nextId) => {
              setSelectedId(nextId)
              replaceProjectId(nextId)
            }}
          />
        ) : null}
        <UsageSpendFigures productId={activeProductId} projectId={selectedId} />
      </div>

      <div className="usage-grid mos-stagger">
        <article className="usage-card usage-card-traces">
          <div className="usage-traces-head">
            <div>
              <h2 className="usage-card-title">Tool traces</h2>
              <p className="usage-card-note">
                {selectedProject
                  ? `Showing calls for ${selectedProject.headline}.`
                  : 'Pick a Studio project to inspect its session tools.'}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="page-lede" role="status" aria-live="polite">
              Loading projects…
            </p>
          ) : null}

          {error === 'Unauthorized' ? (
            <p className="error">
              <Link href="/login?next=/usage">Sign in</Link> to view tool traces.
            </p>
          ) : error === 'Select a Product first.' ? (
            <div className="usage-empty">
              <p className="page-lede">Select a Product before loading Studio traces.</p>
              <Link href="/products" className="btn btn-primary">
                Open Products
              </Link>
            </div>
          ) : error ? (
            <p className="error">{error}</p>
          ) : null}

          {!loading && !error && projects.length === 0 ? (
            <div className="usage-empty">
              <p className="page-lede">No Studio projects yet — traces appear after a chat turn.</p>
              <Link href="/studio" className="btn btn-primary">
                Open Studio
              </Link>
            </div>
          ) : null}

          {!loading && projects.length > 0 ? (
            <div className="usage-trace-panel">
              <div className="usage-trace-stats">
                <span className="usage-stat">
                  <strong className="tabular-nums">{entries.length}</strong>
                  <span>calls</span>
                </span>
                <span className="usage-stat">
                  <strong className="tabular-nums">{failedCount}</strong>
                  <span>failed</span>
                </span>
                {tracesLoading ? (
                  <span className="usage-stat usage-stat-live" role="status" aria-live="polite">
                    Updating…
                  </span>
                ) : null}
              </div>
              <ToolTrace entries={entries} />
            </div>
          ) : null}
        </article>
      </div>
    </section>
  )
}

export default function UsagePage() {
  return (
    <Suspense
      fallback={
        <section className="panel usage-page mos-enter">
          <p className="eyebrow">Usage</p>
          <h1 className="usage-title">Usage</h1>
          <p className="page-lede" role="status" aria-live="polite">
            Loading usage…
          </p>
        </section>
      }
    >
      <UsagePageInner />
    </Suspense>
  )
}
