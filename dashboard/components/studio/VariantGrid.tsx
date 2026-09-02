'use client'

import { VARIANT_RENDER_GBP, estimateVariantMatrixGbp } from '@synawood/creative/variant/plan'
import {
  VARIANT_SOFT_CAP,
  formatVariantLabel,
  type AdPlatform,
  type VariantSpec,
} from '@synawood/creative/variant/schema'
import type { StudioProject } from '@synawood/creative/project/schema'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { StudioSpinner } from './StudioSpinner'

type PromoteField = 'hook' | 'end_card'

const PROMOTE_FIELD_LABELS: Record<PromoteField, string> = {
  hook: 'Opening line',
  end_card: 'Call to action',
}

const PROMOTE_FIELD_OPTIONS = Object.keys(PROMOTE_FIELD_LABELS) as PromoteField[]

type VariantChildRow = {
  id: string
  name: string | null
  status: string
  variantSpec: VariantSpec | null
  createdAt: string
}

type PlanResponse = {
  plan?: {
    items: VariantSpec[]
    requestedCount: number
    truncated: boolean
    estimatedGbp: number
    createEstimatedGbp?: number
    exportEstimatedGbp?: number
    warnings: string[]
  }
  error?: string
}

type RenderResponse = {
  children?: Array<{ projectId: string; label: string; variantSpec: VariantSpec }>
  estimatedGbp?: number
  warnings?: string[]
  workerHint?: string | null
  error?: string
}

type BranchSummaryDto = {
  id: string
  name: string
  slug: string
  isMain: boolean
  isActive: boolean
}

type VariantGridProps = {
  project: StudioProject
  open: boolean
  onClose: () => void
  /** Reload parent after promote so Studio shows updated hook/CTA. */
  onParentChanged?: () => void
}

const PLATFORM_OPTIONS: Array<{ id: AdPlatform; label: string }> = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'ig_reels', label: 'Instagram Reels' },
  { id: 'yt_shorts', label: 'YouTube Shorts' },
  { id: 'meta_feed', label: 'Meta feed' },
]

const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_OPTIONS.map((option) => [option.id, option.label]),
)

const UNTAGGED_BRANCH_FILTER = '__untagged__'

const groupByPlatform = (
  rows: VariantChildRow[],
): Array<{ platform: string; label: string; rows: VariantChildRow[] }> => {
  const groups = new Map<string, VariantChildRow[]>()
  for (const row of rows) {
    const platform = row.variantSpec?.platform ?? 'other'
    const existing = groups.get(platform)
    if (existing) existing.push(row)
    else groups.set(platform, [row])
  }
  return [...groups.entries()].map(([platform, groupRows]) => ({
    platform,
    label: PLATFORM_LABELS[platform] ?? 'Other',
    rows: groupRows,
  }))
}

const statusLabel = (status: string): string => {
  if (status === 'drafting') return 'Draft'
  if (status === 'rendering') return 'Exporting'
  if (status === 'needs_review') return 'Needs review'
  if (status === 'approved') return 'Approved'
  if (status === 'killed') return 'Discarded'
  return status
}

const toggleIndex = (list: number[], index: number): number[] =>
  list.includes(index)
    ? list.filter((item) => item !== index)
    : [...list, index].sort((a, b) => a - b)

const togglePlatform = (list: AdPlatform[], id: AdPlatform): AdPlatform[] =>
  list.includes(id) ? list.filter((item) => item !== id) : [...list, id]

const toggleLocale = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((item) => item !== id) : [...list, id]

const LOCALE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'es', label: 'Español' },
  { id: 'ar', label: 'Arabic' },
] as const

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many)

export const VariantGrid = ({ project, open, onClose, onParentChanged }: VariantGridProps) => {
  const hooks = project.brief?.messaging.hookCandidates ?? []
  const ctas = project.brief?.messaging.ctaCandidates ?? []

  const [children, setChildren] = useState<VariantChildRow[]>([])
  const [branches, setBranches] = useState<BranchSummaryDto[]>([])
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [platforms, setPlatforms] = useState<AdPlatform[]>(['tiktok', 'ig_reels'])
  const [locales, setLocales] = useState<string[]>([])
  const [hookIndexes, setHookIndexes] = useState<number[]>([0, 1].filter((i) => i < hooks.length))
  const [ctaIndexes, setCtaIndexes] = useState<number[]>([0, 1].filter((i) => i < ctas.length))
  const [pendingPlan, setPendingPlan] = useState<PlanResponse['plan'] | null>(null)
  const [spendOpen, setSpendOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [overrideHook, setOverrideHook] = useState('')
  const [overrideCta, setOverrideCta] = useState('')
  const [overrideRevision, setOverrideRevision] = useState<number | null>(null)
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [workerHint, setWorkerHint] = useState<string | null>(null)
  const [promoteFields, setPromoteFields] = useState<PromoteField[]>(['hook', 'end_card'])
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoteBusy, setPromoteBusy] = useState(false)
  const [promoteStatus, setPromoteStatus] = useState<string | null>(null)

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const branch of branches) map.set(branch.id, branch.name)
    return map
  }, [branches])

  const activeBranch = useMemo(
    () => branches.find((branch) => branch.isActive) ?? branches.find((branch) => branch.isMain),
    [branches],
  )

  const filteredChildren = useMemo(() => {
    if (branchFilter === 'all') return children
    if (branchFilter === UNTAGGED_BRANCH_FILTER) {
      return children.filter((child) => !child.variantSpec?.sourceBranchId)
    }
    return children.filter((child) => child.variantSpec?.sourceBranchId === branchFilter)
  }, [branchFilter, children])

  const childGroups = useMemo(() => groupByPlatform(filteredChildren), [filteredChildren])
  const untaggedCount = useMemo(
    () => children.filter((child) => !child.variantSpec?.sourceBranchId).length,
    [children],
  )
  const showBranchFilters =
    branches.length > 1 ||
    untaggedCount > 0 ||
    children.some((child) => child.variantSpec?.sourceBranchId)

  const loadChildren = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/studio/projects/${project.id}/variants`)
      const body = (await response.json()) as { children?: VariantChildRow[]; error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Failed to load ad versions')
      setChildren(body.children ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ad versions')
    } finally {
      setLoading(false)
    }
  }, [project.id])

  const loadBranches = useCallback(async () => {
    try {
      const response = await fetch(`/api/studio/projects/${project.id}/branches`)
      const body = (await response.json()) as {
        branches?: BranchSummaryDto[]
        error?: string
      }
      if (!response.ok) {
        // Non-fatal: grid still works without branch labels.
        return
      }
      setBranches(body.branches ?? [])
    } catch {
      // ignore — branch awareness is additive
    }
  }, [project.id])

  useEffect(() => {
    if (!open) return
    void loadChildren()
    void loadBranches()
    setHookIndexes([0, 1].filter((i) => i < hooks.length))
    setCtaIndexes([0, 1].filter((i) => i < ctas.length))
    setBranchFilter('all')
  }, [open, loadChildren, loadBranches, hooks.length, ctas.length])

  const plannedCount = useMemo(
    () => platforms.length * hookIndexes.length * ctaIndexes.length * Math.max(locales.length, 1),
    [platforms, hookIndexes, ctaIndexes, locales],
  )

  const exportEstimatedGbp = useMemo(
    () => estimateVariantMatrixGbp({ variantCount: plannedCount, includeRenders: true }),
    [plannedCount],
  )

  const exampleCombos = useMemo(() => {
    const samples: string[] = []
    for (const platform of platforms) {
      for (const hookIndex of hookIndexes) {
        for (const ctaIndex of ctaIndexes) {
          samples.push(formatVariantLabel({ platform, hookIndex, ctaIndex, locale: locales[0] }))
          if (samples.length >= 3) return samples
        }
      }
    }
    return samples
  }, [platforms, hookIndexes, ctaIndexes, locales])

  const selectChild = async (childId: string) => {
    setSelectedChildId(childId)
    setError(null)
    try {
      const response = await fetch(`/api/studio/projects/${project.id}/variants/${childId}`)
      const body = (await response.json()) as {
        hookText?: string
        ctaText?: string
        revision?: number
        error?: string
      }
      if (!response.ok) throw new Error(body.error ?? 'Failed to load this ad version')
      setOverrideHook(body.hookText ?? '')
      setOverrideCta(body.ctaText ?? '')
      setOverrideRevision(body.revision ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this ad version')
    }
  }

  const runPlanThenConfirm = async () => {
    if (!platforms.length || !hookIndexes.length || !ctaIndexes.length) {
      setError('Choose at least one place to publish, one opening line, and one call to action.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/studio/projects/${project.id}/plan-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms,
          hookIndexes,
          ctaIndexes,
          locales: locales.length ? locales : undefined,
          confirmSpend: plannedCount > VARIANT_SOFT_CAP,
        }),
      })
      const body = (await response.json()) as PlanResponse
      if (!response.ok || !body.plan) throw new Error(body.error ?? 'Could not build the plan')
      setPendingPlan(body.plan)
      setSpendOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the plan')
    } finally {
      setBusy(false)
    }
  }

  const runRender = async () => {
    if (!pendingPlan) return
    setSpendOpen(false)
    setBusy(true)
    setError(null)
    setWorkerHint(null)
    try {
      const response = await fetch(`/api/studio/projects/${project.id}/render-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: pendingPlan.items,
          confirmSpend: true,
          enqueueRenders: false,
        }),
      })
      const body = (await response.json()) as RenderResponse
      if (!response.ok) throw new Error(body.error ?? 'Could not create ad versions')
      setWorkerHint(body.workerHint ?? null)
      setPendingPlan(null)
      await loadChildren()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ad versions')
    } finally {
      setBusy(false)
    }
  }

  const saveOverrides = async () => {
    if (!selectedChildId || overrideRevision == null) return
    setOverrideSaving(true)
    setError(null)
    setPromoteStatus(null)
    try {
      const response = await fetch(
        `/api/studio/projects/${project.id}/variants/${selectedChildId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hookText: overrideHook,
            ctaText: overrideCta,
            expectedRevision: overrideRevision,
          }),
        },
      )
      const body = (await response.json()) as {
        revision?: number
        error?: string
      }
      if (!response.ok) throw new Error(body.error ?? 'Could not save changes')
      if (typeof body.revision === 'number') setOverrideRevision(body.revision)
      await loadChildren()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes')
    } finally {
      setOverrideSaving(false)
    }
  }

  const togglePromoteField = (field: PromoteField) => {
    setPromoteFields((prev) =>
      prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field],
    )
  }

  const runPromote = async () => {
    if (!selectedChildId || promoteFields.length === 0) return
    setPromoteBusy(true)
    setError(null)
    setPromoteStatus(null)
    try {
      const response = await fetch(
        `/api/studio/projects/${project.id}/variants/${selectedChildId}/promote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: promoteFields,
            expectedRevision: project.revision,
          }),
        },
      )
      const body = (await response.json()) as {
        applied?: PromoteField[]
        skipped?: PromoteField[]
        error?: string
      }
      if (!response.ok) throw new Error(body.error ?? 'Could not promote to main cut')
      const applied = body.applied ?? []
      const skipped = body.skipped ?? []
      setPromoteStatus(
        `Updated main cut: ${applied.map((f) => PROMOTE_FIELD_LABELS[f]).join(', ')}${
          skipped.length
            ? ` · skipped ${skipped.map((f) => PROMOTE_FIELD_LABELS[f]).join(', ')}`
            : ''
        }`,
      )
      setPromoteOpen(false)
      onParentChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not promote to main cut')
    } finally {
      setPromoteBusy(false)
    }
  }

  if (!open) return null

  const canPlan = Boolean(project.brief) && hooks.length > 0 && ctas.length > 0
  const overSoftCap = plannedCount > VARIANT_SOFT_CAP

  return (
    <>
      <div
        className="dialog-root brand-studio-root variant-grid-root"
        role="dialog"
        aria-modal="true"
        aria-label="Create ad versions"
      >
        <button type="button" className="dialog-backdrop" onClick={onClose} aria-label="Close" />
        <div className="dialog-panel brand-studio-panel variant-grid-panel">
          <header className="brand-studio-header">
            <div>
              <p className="eyebrow">This project</p>
              <h2>Create ad versions</h2>
              <p className="muted variant-grid-lede">
                Choose where each ad runs, which opening line it uses, and which call to action. We
                make <strong>one separate cut for every combination</strong> — same footage,
                different packaging
                {branches.length > 1 && activeBranch ? (
                  <>
                    {' '}
                    from the <strong>{activeBranch.name}</strong> branch tip
                  </>
                ) : null}
                .
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </header>

          <div className={`variant-grid-layout${selectedChildId ? ' has-drawer' : ''}`}>
            <div className="variant-grid-main">
              {!canPlan ? (
                <div className="variant-empty-card">
                  <h3>Finish the brief first</h3>
                  <p className="muted">
                    Open Brand Studio, extract from your URL, then Apply. Opening lines and CTAs
                    from that brief become the choices here.
                  </p>
                </div>
              ) : (
                <section className="variant-plan-section" aria-labelledby="ad-versions-build">
                  <h3 id="ad-versions-build">Build the set</h3>

                  <ol className="variant-steps">
                    <li className="variant-step">
                      <div className="variant-step-head">
                        <span className="variant-step-num" aria-hidden>
                          1
                        </span>
                        <div>
                          <h4>Where should these ads run?</h4>
                          <p className="muted">Each place gets its own size and framing.</p>
                        </div>
                      </div>
                      <div className="variant-chip-row" role="group" aria-label="Places to publish">
                        {PLATFORM_OPTIONS.map((option) => {
                          const selected = platforms.includes(option.id)
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`variant-choice${selected ? ' is-selected' : ''}`}
                              aria-pressed={selected}
                              onClick={() =>
                                setPlatforms((prev) => togglePlatform(prev, option.id))
                              }
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </li>

                    <li className="variant-step">
                      <div className="variant-step-head">
                        <span className="variant-step-num" aria-hidden>
                          2
                        </span>
                        <div>
                          <h4>Which opening lines?</h4>
                          <p className="muted">The first words on screen — pick one or many.</p>
                        </div>
                      </div>
                      <div className="variant-chip-row" role="group" aria-label="Opening lines">
                        {hooks.map((hook, index) => {
                          const selected = hookIndexes.includes(index)
                          return (
                            <button
                              key={`hook-${index}`}
                              type="button"
                              className={`variant-choice variant-choice-wide${selected ? ' is-selected' : ''}`}
                              aria-pressed={selected}
                              title={hook}
                              onClick={() => setHookIndexes((prev) => toggleIndex(prev, index))}
                            >
                              <span className="variant-choice-index">{index + 1}</span>
                              <span className="variant-choice-text">{hook}</span>
                            </button>
                          )
                        })}
                      </div>
                    </li>

                    <li className="variant-step">
                      <div className="variant-step-head">
                        <span className="variant-step-num" aria-hidden>
                          3
                        </span>
                        <div>
                          <h4>Which calls to action?</h4>
                          <p className="muted">The end-card line — pick one or many.</p>
                        </div>
                      </div>
                      <div className="variant-chip-row" role="group" aria-label="Calls to action">
                        {ctas.map((cta, index) => {
                          const selected = ctaIndexes.includes(index)
                          return (
                            <button
                              key={`cta-${index}`}
                              type="button"
                              className={`variant-choice${selected ? ' is-selected' : ''}`}
                              aria-pressed={selected}
                              title={cta}
                              onClick={() => setCtaIndexes((prev) => toggleIndex(prev, index))}
                            >
                              <span className="variant-choice-index">{index + 1}</span>
                              <span className="variant-choice-text">{cta}</span>
                            </button>
                          )
                        })}
                      </div>
                    </li>

                    <li className="variant-step">
                      <div className="variant-step-head">
                        <span className="variant-step-num" aria-hidden>
                          4
                        </span>
                        <div>
                          <h4>Languages? (optional)</h4>
                          <p className="muted">
                            Leave empty to keep this cut’s locale. Each pick multiplies the set.
                          </p>
                        </div>
                      </div>
                      <div className="variant-chip-row" role="group" aria-label="Locales">
                        {LOCALE_OPTIONS.map((option) => {
                          const selected = locales.includes(option.id)
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`variant-choice${selected ? ' is-selected' : ''}`}
                              aria-pressed={selected}
                              onClick={() => setLocales((prev) => toggleLocale(prev, option.id))}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  </ol>

                  <div
                    className={`variant-formula${overSoftCap ? ' is-warn' : ''}${plannedCount === 0 ? ' is-empty' : ''}`}
                    role="status"
                    aria-live="polite"
                  >
                    <div className="variant-formula-math">
                      <span>
                        <strong>{platforms.length}</strong>{' '}
                        {plural(platforms.length, 'place', 'places')}
                      </span>
                      <span className="variant-formula-op" aria-hidden>
                        ×
                      </span>
                      <span>
                        <strong>{hookIndexes.length}</strong>{' '}
                        {plural(hookIndexes.length, 'opening', 'openings')}
                      </span>
                      <span className="variant-formula-op" aria-hidden>
                        ×
                      </span>
                      <span>
                        <strong>{ctaIndexes.length}</strong>{' '}
                        {plural(ctaIndexes.length, 'CTA', 'CTAs')}
                      </span>
                      {locales.length > 0 ? (
                        <>
                          <span className="variant-formula-op" aria-hidden>
                            ×
                          </span>
                          <span>
                            <strong>{locales.length}</strong>{' '}
                            {plural(locales.length, 'locale', 'locales')}
                          </span>
                        </>
                      ) : null}
                      <span className="variant-formula-op" aria-hidden>
                        =
                      </span>
                      <span className="variant-formula-total">
                        <strong>{plannedCount}</strong>{' '}
                        {plural(plannedCount, 'ad version', 'ad versions')}
                      </span>
                    </div>
                    {plannedCount > 0 ? (
                      <>
                        <p className="variant-formula-cost" role="status">
                          <span>
                            Create now: <strong>free</strong>
                          </span>
                          <span className="variant-formula-cost-sep" aria-hidden>
                            ·
                          </span>
                          <span>
                            Export all later: ~£{exportEstimatedGbp.toFixed(2)}
                            <span className="muted"> (~£{VARIANT_RENDER_GBP.toFixed(2)} each)</span>
                          </span>
                        </p>
                        <p className="variant-formula-hint muted">
                          Example{exampleCombos.length === 1 ? '' : 's'}:{' '}
                          {exampleCombos.map((label) => (
                            <span key={label} className="variant-example-pill">
                              {label}
                            </span>
                          ))}
                          {plannedCount > exampleCombos.length
                            ? ` · +${plannedCount - exampleCombos.length} more`
                            : null}
                        </p>
                      </>
                    ) : (
                      <p className="muted">Select at least one option in each step above.</p>
                    )}
                    {overSoftCap ? (
                      <p className="variant-formula-cap">
                        That’s more than {VARIANT_SOFT_CAP} at once. We’ll ask you to confirm before
                        creating them.
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || plannedCount === 0}
                    onClick={() => void runPlanThenConfirm()}
                  >
                    {busy
                      ? 'Preparing…'
                      : `Create ${plannedCount || ''} ${plural(plannedCount || 0, 'ad version', 'ad versions')}`.trim()}
                  </button>
                </section>
              )}

              <section className="variant-cells-section" aria-labelledby="ad-versions-list">
                <h3 id="ad-versions-list">Your ad versions</h3>
                {showBranchFilters ? (
                  <div
                    className="variant-branch-filter"
                    role="group"
                    aria-label="Filter by parent branch"
                  >
                    <button
                      type="button"
                      className={`variant-choice${branchFilter === 'all' ? ' is-selected' : ''}`}
                      aria-pressed={branchFilter === 'all'}
                      onClick={() => setBranchFilter('all')}
                    >
                      All · {children.length}
                    </button>
                    {branches.map((branch) => {
                      const count = children.filter(
                        (child) => child.variantSpec?.sourceBranchId === branch.id,
                      ).length
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          className={`variant-choice${branchFilter === branch.id ? ' is-selected' : ''}`}
                          aria-pressed={branchFilter === branch.id}
                          onClick={() => setBranchFilter(branch.id)}
                        >
                          {branch.name}
                          {count > 0 ? ` · ${count}` : ''}
                        </button>
                      )
                    })}
                    {untaggedCount > 0 ? (
                      <button
                        type="button"
                        className={`variant-choice${branchFilter === UNTAGGED_BRANCH_FILTER ? ' is-selected' : ''}`}
                        aria-pressed={branchFilter === UNTAGGED_BRANCH_FILTER}
                        onClick={() => setBranchFilter(UNTAGGED_BRANCH_FILTER)}
                        title="Created before named branches were stamped"
                      >
                        Untagged · {untaggedCount}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {loading ? <StudioSpinner size="sm" label="Loading" /> : null}
                {!loading && children.length === 0 ? (
                  <p className="brand-studio-empty">
                    None yet. Build a set above — each version opens as its own Studio project.
                  </p>
                ) : null}
                {!loading && children.length > 0 && filteredChildren.length === 0 ? (
                  <p className="muted">No ad versions for this branch filter.</p>
                ) : null}
                {childGroups.map((group) => (
                  <div key={group.platform} className="variant-cells-group">
                    <h4 className="variant-cells-group-title">
                      {group.label}
                      <span className="muted"> · {group.rows.length}</span>
                    </h4>
                    <div className="variant-cells-grid">
                      {group.rows.map((child) => {
                        const sourceId = child.variantSpec?.sourceBranchId
                        const sourceLabel = sourceId
                          ? (branchNameById.get(sourceId) ?? 'Branch')
                          : null
                        return (
                          <article
                            key={child.id}
                            className={`variant-cell${selectedChildId === child.id ? ' is-selected' : ''}`}
                          >
                            <button
                              type="button"
                              className="variant-cell-select"
                              onClick={() => void selectChild(child.id)}
                            >
                              <strong>
                                {child.variantSpec?.label ?? child.name ?? 'Ad version'}
                              </strong>
                              <span className="muted">{statusLabel(child.status)}</span>
                              {sourceLabel ? (
                                <span className="variant-cell-branch">From {sourceLabel}</span>
                              ) : null}
                            </button>
                            <a className="btn btn-ghost btn-sm" href={`/studio/${child.id}`}>
                              Open cut
                            </a>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {workerHint ? <p className="muted">{workerHint}</p> : null}
              </section>

              {error ? <p className="error">{error}</p> : null}
            </div>

            {selectedChildId ? (
              <aside className="variant-overrides-drawer" aria-label="Edit this ad version">
                <h3>Edit this version</h3>
                <p className="muted">
                  Changes stay on this cut only until you promote them to the main project.
                </p>
                <label className="variant-override-field">
                  <span>Opening line</span>
                  <textarea
                    rows={3}
                    value={overrideHook}
                    onChange={(event) => setOverrideHook(event.target.value)}
                  />
                </label>
                <label className="variant-override-field">
                  <span>Call to action</span>
                  <textarea
                    rows={2}
                    value={overrideCta}
                    onChange={(event) => setOverrideCta(event.target.value)}
                  />
                </label>
                <div className="variant-override-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={overrideSaving || !overrideHook.trim() || !overrideCta.trim()}
                    onClick={() => void saveOverrides()}
                  >
                    {overrideSaving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setSelectedChildId(null)}
                  >
                    Done
                  </button>
                </div>

                <div className="variant-promote-block">
                  <h4>Promote to main cut</h4>
                  <p className="muted">
                    Copy the opening line and/or call to action from this version onto the main
                    project.
                  </p>
                  <div
                    className="variant-promote-fields"
                    role="group"
                    aria-label="Fields to promote"
                  >
                    {PROMOTE_FIELD_OPTIONS.map((field) => {
                      const checked = promoteFields.includes(field)
                      return (
                        <label key={field} className="variant-promote-field">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePromoteField(field)}
                          />
                          <span>{PROMOTE_FIELD_LABELS[field]}</span>
                        </label>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={promoteBusy || promoteFields.length === 0}
                    onClick={() => setPromoteOpen(true)}
                  >
                    Promote to main cut…
                  </button>
                  {promoteStatus ? (
                    <p className="variant-promote-status" role="status">
                      {promoteStatus}
                    </p>
                  ) : null}
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={spendOpen && Boolean(pendingPlan)}
        title={
          pendingPlan
            ? `Create ${pendingPlan.items.length} ad ${plural(pendingPlan.items.length, 'version', 'versions')}?`
            : 'Create ad versions?'
        }
        body={
          pendingPlan
            ? `We’ll add ${pendingPlan.items.length} new Studio projects that share this cut’s media, each with its own opening line and CTA.${
                pendingPlan.truncated
                  ? ` You asked for ${pendingPlan.requestedCount}; we’ll create the first ${pendingPlan.items.length} for now.`
                  : ''
              } Creating them is free. Exporting all finished files later is about £${(
                pendingPlan.exportEstimatedGbp ?? pendingPlan.estimatedGbp
              ).toFixed(2)} (~£${VARIANT_RENDER_GBP.toFixed(2)} each).`
            : ''
        }
        confirmLabel="Create versions"
        cancelLabel="Cancel"
        danger={false}
        onConfirm={() => void runRender()}
        onCancel={() => {
          setSpendOpen(false)
          setPendingPlan(null)
        }}
      />

      <ConfirmDialog
        open={promoteOpen}
        title="Promote to main cut?"
        body={`This updates your main project with: ${promoteFields
          .map((field) => PROMOTE_FIELD_LABELS[field])
          .join(', ')}. Other fields on the main cut stay as they are.`}
        confirmLabel={promoteBusy ? 'Promoting…' : 'Promote'}
        cancelLabel="Cancel"
        danger={false}
        onConfirm={() => void runPromote()}
        onCancel={() => setPromoteOpen(false)}
      />
    </>
  )
}
