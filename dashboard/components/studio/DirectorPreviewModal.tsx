'use client'

import type { DirectorPlan, Scene } from '@synawood/creative/intent'
import { useEffect, useMemo, useState } from 'react'
import {
  directorCostLabel,
  directorEditLabel,
  directorScopeLabel,
  directorSkippedDetail,
  directorSkippedEdits,
  groupDirectorEditsByScene,
  selectedDirectorEditCount,
} from './director-preview-helpers'
import { StudioSpinner } from './StudioSpinner'

export type SaveAsBranchInput = {
  branchName: string
  switchAfter: boolean
}

type DirectorPreviewModalProps = {
  open: boolean
  plan: DirectorPlan | null
  scenes?: Pick<Scene, 'id' | 'role' | 'label'>[]
  busy?: boolean
  error?: string | null
  /** Parent projects only — named branches (ADR-0030), not Ad Generator children. */
  allowSaveAsBranch?: boolean
  onClose: () => void
  onApply: (excludeMutationIds: string[]) => void
  onSaveAsBranch?: (excludeMutationIds: string[], input: SaveAsBranchInput) => void
  onReject: () => void
  onRefine: (note: string) => void
  onRefresh?: () => void
}

export const DirectorPreviewModal = ({
  open,
  plan,
  scenes = [],
  busy = false,
  error = null,
  allowSaveAsBranch = false,
  onClose,
  onApply,
  onSaveAsBranch,
  onReject,
  onRefine,
  onRefresh,
}: DirectorPreviewModalProps) => {
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [skippedOpen, setSkippedOpen] = useState(false)
  const [refineOpen, setRefineOpen] = useState(false)
  const [refineNote, setRefineNote] = useState('')
  const [saveAsBranchOpen, setSaveAsBranchOpen] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [switchAfter, setSwitchAfter] = useState(true)
  const [rationaleOpen, setRationaleOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setExcluded(new Set())
    setSkippedOpen(Boolean(plan?.edits.some((edit) => edit.status === 'rejected')))
    setRefineOpen(false)
    setRefineNote('')
    setSaveAsBranchOpen(false)
    setBranchName('')
    setSwitchAfter(true)
    setRationaleOpen(false)
  }, [open, plan?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  const groups = useMemo(
    () => (plan ? groupDirectorEditsByScene(plan.edits, scenes) : []),
    [plan, scenes],
  )
  const skipped = useMemo(() => (plan ? directorSkippedEdits(plan.edits) : []), [plan])
  const selectedCount = useMemo(() => {
    if (!plan) return 0
    return selectedDirectorEditCount(plan, excluded)
  }, [plan, excluded])
  const actionableCount = useMemo(() => {
    if (!plan) return 0
    return plan.edits.filter((edit) => edit.status !== 'rejected').length
  }, [plan])

  if (!open) return null

  if (!plan) {
    return (
      <div className="dialog-root director-preview-root" role="presentation">
        <button type="button" className="dialog-backdrop" aria-label="Close" onClick={onClose} />
        <div
          className="dialog-panel director-preview-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="director-preview-title"
        >
          <h2 id="director-preview-title" className="dialog-title">
            Director preview
          </h2>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : (
            <>
              {busy ? <StudioSpinner size="sm" /> : null}
              <p className="muted" role="status">
                {busy ? 'Building preview…' : 'No plan yet.'}
              </p>
            </>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const rationale = plan.rationale.trim()
  const rationaleLong = rationale.length > 140
  const costLabel = directorCostLabel(plan)
  const showCostBreakdown = plan.generatorCalls.length > 0
  const styleLabel = plan.style ? plan.style : null

  const toggleExcluded = (editId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(editId)) next.delete(editId)
      else next.add(editId)
      return next
    })
  }

  return (
    <div className="dialog-root director-preview-root" role="presentation">
      <button type="button" className="dialog-backdrop" aria-label="Close" onClick={onClose} />
      <div
        className="dialog-panel director-preview-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="director-preview-title"
      >
        <header className="director-preview-header">
          <h2 id="director-preview-title" className="dialog-title">
            Director preview
          </h2>
          <p className="director-preview-meta">
            {styleLabel ? <span>{styleLabel}</span> : null}
            <span>
              {actionableCount} change{actionableCount === 1 ? '' : 's'}
            </span>
            <span>{directorScopeLabel(plan)}</span>
            <span>{costLabel}</span>
            {plan.status === 'stale' ? (
              <span className="director-preview-stale">Out of date</span>
            ) : null}
          </p>
        </header>

        {rationale ? (
          <div className="director-preview-rationale-block">
            <p className={`director-preview-rationale${rationaleOpen ? ' is-open' : ''}`}>
              {rationale}
            </p>
            {rationaleLong ? (
              <button
                type="button"
                className="director-preview-text-toggle"
                onClick={() => setRationaleOpen((openNow) => !openNow)}
              >
                {rationaleOpen ? 'Less' : 'More'}
              </button>
            ) : null}
          </div>
        ) : null}

        {showCostBreakdown ? (
          <details className="director-preview-cost-details">
            <summary>Cost breakdown · £{plan.costEstimateGbp.toFixed(2)}</summary>
            <ul className="director-preview-cost-list">
              {plan.generatorCalls.map((call, index) => (
                <li key={`${call.tool}-${index}`}>
                  <span>{call.tool.replaceAll('_', ' ')}</span>
                  <span className="muted"> £{call.estimatedCostGbp.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="director-preview-body">
          <h3 className="director-preview-section-title">What would change</h3>
          {actionableCount === 0 ? (
            <p className="muted">Nothing ready to apply. Refine the brief or try another style.</p>
          ) : (
            <div className="director-preview-groups">
              {groups.map((group) => (
                <section key={group.sceneId ?? 'timeline'} className="director-preview-group">
                  {groups.length > 1 || group.sceneId ? (
                    <h4 className="director-preview-group-title">{group.label}</h4>
                  ) : null}
                  <ul className="director-preview-edits">
                    {group.edits.map((edit) => {
                      const checked = !excluded.has(edit.id)
                      return (
                        <li key={edit.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busy || plan.status === 'stale'}
                              onChange={() => toggleExcluded(edit.id)}
                            />
                            <span className="director-preview-edit-label">
                              {directorEditLabel(edit)}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {skipped.length > 0 ? (
            <details
              className="director-preview-skipped"
              open={skippedOpen}
              onToggle={(event) => setSkippedOpen((event.target as HTMLDetailsElement).open)}
            >
              <summary>
                Couldn’t apply {skipped.length} idea{skipped.length === 1 ? '' : 's'}
                {skipped[0]?.rejectReason
                  ? ` — ${skipped[0].rejectReason}${skipped.length > 1 ? '…' : ''}`
                  : ''}
              </summary>
              <ul>
                {skipped.map((edit) => (
                  <li key={edit.id}>{directorSkippedDetail(edit)}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        {refineOpen ? (
          <div className="director-preview-refine">
            <label htmlFor="director-refine-note">
              What should change?
              <textarea
                id="director-refine-note"
                rows={3}
                maxLength={400}
                value={refineNote}
                disabled={busy}
                placeholder="e.g. Keep the end card, make the hook shorter"
                onChange={(event) => setRefineNote(event.target.value)}
              />
            </label>
            <div className="director-preview-refine-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => {
                  setRefineOpen(false)
                  setRefineNote('')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy || refineNote.trim().length === 0}
                onClick={() => onRefine(refineNote.trim())}
              >
                {busy ? 'Refining…' : 'Update plan'}
              </button>
            </div>
          </div>
        ) : null}

        {saveAsBranchOpen && allowSaveAsBranch && onSaveAsBranch ? (
          <form
            className="director-preview-save-branch"
            onSubmit={(event) => {
              event.preventDefault()
              const name = branchName.trim()
              if (!name || busy || selectedCount === 0) return
              onSaveAsBranch([...excluded], { branchName: name, switchAfter })
            }}
          >
            <p className="muted director-preview-save-branch-hint">
              Applies the selected changes, then forks a named tip (does not replace main).
            </p>
            <label htmlFor="director-save-branch-name">
              Branch name
              <input
                id="director-save-branch-name"
                type="text"
                maxLength={40}
                value={branchName}
                disabled={busy}
                autoFocus
                placeholder="Funny / Luxury / …"
                onChange={(event) => setBranchName(event.target.value)}
              />
            </label>
            <label className="director-preview-save-branch-switch">
              <input
                type="checkbox"
                checked={switchAfter}
                disabled={busy}
                onChange={(event) => setSwitchAfter(event.target.checked)}
              />
              <span>Switch to this branch after save</span>
            </label>
            <div className="director-preview-refine-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => {
                  setSaveAsBranchOpen(false)
                  setBranchName('')
                  setSwitchAfter(true)
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                disabled={busy || selectedCount === 0 || branchName.trim().length === 0}
              >
                {busy ? 'Saving…' : 'Save as branch'}
              </button>
            </div>
          </form>
        ) : null}

        <div className="dialog-actions director-preview-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || plan.status === 'applied' || plan.status === 'rejected'}
            onClick={onReject}
          >
            Discard
          </button>
          <span className="director-preview-actions-spacer" />
          {plan.status === 'stale' && onRefresh ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onRefresh}>
              {busy ? 'Refreshing…' : 'Refresh'}
            </button>
          ) : null}
          {!refineOpen && !saveAsBranchOpen && plan.status !== 'stale' ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                setSaveAsBranchOpen(false)
                setRefineOpen(true)
              }}
            >
              Refine
            </button>
          ) : null}
          {allowSaveAsBranch &&
          onSaveAsBranch &&
          !refineOpen &&
          !saveAsBranchOpen &&
          plan.status !== 'stale' ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || selectedCount === 0}
              title="Apply selected edits onto a new named branch"
              onClick={() => {
                setRefineOpen(false)
                setSaveAsBranchOpen(true)
              }}
            >
              Save as branch
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              busy ||
              selectedCount === 0 ||
              plan.status === 'stale' ||
              refineOpen ||
              saveAsBranchOpen
            }
            onClick={() => onApply([...excluded])}
          >
            {busy
              ? 'Applying…'
              : selectedCount === 0
                ? 'Apply'
                : `Apply ${selectedCount} change${selectedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
