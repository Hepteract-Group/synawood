'use client'

import type { Suggestion } from '@synawood/creative/intent'
import type { StudioProject } from '@synawood/creative/project/client'
import { useEffect, useMemo, useState } from 'react'
import {
  formatClipDuration,
  selectedSuggestionsCost,
  suggestionCostLabel,
  suggestionLayer,
} from './contextual-drawer-helpers'
import { useContextualSuggestions } from './useContextualSuggestions'

type ContextualDrawerProps = {
  open: boolean
  projectId: string
  project: StudioProject
  clipId: string
  disabled?: boolean
  onClose: () => void
  onProjectApplied: (project: StudioProject) => void
  onError: (message: string) => void
}

export const ContextualDrawer = ({
  open,
  projectId,
  project,
  clipId,
  disabled = false,
  onClose,
  onProjectApplied,
  onError,
}: ContextualDrawerProps) => {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const { state, stale, refresh, toggleSelected, applyOne, applySelected, dismissOne } =
    useContextualSuggestions({
      projectId,
      clipId: open ? clipId : null,
      revision: project.revision,
      enabled: open && !disabled,
      onProjectApplied,
      onError,
    })

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const clip = project.clips.find((entry) => entry.id === clipId)
  const scene = project.scenes.find((entry) => entry.clipIds.includes(clipId))
  const asset = clip ? project.assets.find((entry) => entry.id === clip.assetId) : undefined
  const selectedCost = useMemo(
    () => selectedSuggestionsCost(state.suggestions, state.selectedIds),
    [state.selectedIds, state.suggestions],
  )
  const selectedCount = state.selectedIds.size

  if (!open) return null

  const confirmSuggestion = state.suggestions.find((row) => row.id === confirmId) ?? null

  return (
    <section className="contextual-drawer" aria-label="Clip suggestions">
      <header className="contextual-drawer-header">
        <div className="contextual-drawer-heading">
          <p className="contextual-drawer-kicker">Selected clip</p>
          <h2 className="contextual-drawer-title">Suggestions</h2>
          <p className="contextual-drawer-meta">
            <span>Clip {clipId.slice(0, 8)}</span>
            {clip ? <span>{formatClipDuration(clip.durationInFrames, project.fps)}</span> : null}
            {asset ? <span className="contextual-drawer-chip">{asset.kind}</span> : null}
            {scene ? <span className="contextual-drawer-chip">{scene.label}</span> : null}
          </p>
        </div>
        <button
          type="button"
          className="contextual-drawer-close"
          onClick={onClose}
          aria-label="Close suggestions"
        >
          Close
        </button>
      </header>

      <div className="contextual-drawer-body">
        {stale ? (
          <p className="contextual-drawer-banner" role="status">
            Project changed since these suggestions loaded.{' '}
            <button type="button" className="contextual-drawer-link" onClick={refresh}>
              Refresh
            </button>
          </p>
        ) : null}

        {state.status === 'loading' ? (
          <p className="contextual-drawer-status" role="status">
            Loading suggestions…
          </p>
        ) : null}

        {state.error ? (
          <p className="contextual-drawer-status is-error" role="alert">
            {state.error}
          </p>
        ) : null}

        {state.status === 'ready' && state.suggestions.length === 0 ? (
          <div className="contextual-drawer-empty">
            <p className="contextual-drawer-empty-title">No suggestions right now</p>
            <p className="contextual-drawer-empty-lede">
              Try the AI Director for a broader change, or refresh.
            </p>
          </div>
        ) : null}

        {state.suggestions.length > 0 ? (
          <ul className="contextual-drawer-list">
            {state.suggestions.map((suggestion) => (
              <SuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
                checked={state.selectedIds.has(suggestion.id)}
                busy={state.applyingId === suggestion.id || disabled}
                onToggle={() => toggleSelected(suggestion.id)}
                onApply={() => {
                  if (suggestion.requiresGenerator || suggestion.estimatedCostGbp > 0) {
                    setConfirmId(suggestion.id)
                    return
                  }
                  void applyOne(suggestion)
                }}
                onDismiss={() => dismissOne(suggestion.id)}
              />
            ))}
          </ul>
        ) : null}
      </div>

      <footer className="contextual-drawer-footer">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={
            disabled ||
            selectedCount === 0 ||
            state.status === 'loading' ||
            Boolean(state.applyingId)
          }
          onClick={() => void applySelected()}
        >
          {selectedCost > 0
            ? `Apply selected (est £${selectedCost.toFixed(2)})`
            : `Apply selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled || state.status === 'loading'}
          title="Refresh may call the reasoner on paid profiles"
          onClick={refresh}
        >
          Refresh
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={onClose}
        >
          Dismiss all
        </button>
      </footer>

      {confirmSuggestion ? (
        <div className="contextual-drawer-confirm" role="dialog" aria-modal="true">
          <p>
            Apply <strong>{confirmSuggestion.label}</strong> for{' '}
            {suggestionCostLabel(confirmSuggestion)}?
          </p>
          <div className="contextual-drawer-confirm-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmId(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                const target = confirmSuggestion
                setConfirmId(null)
                void applyOne(target, true)
              }}
            >
              Confirm spend
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

const SuggestionRow = ({
  suggestion,
  checked,
  busy,
  onToggle,
  onApply,
  onDismiss,
}: {
  suggestion: Suggestion
  checked: boolean
  busy: boolean
  onToggle: () => void
  onApply: () => void
  onDismiss: () => void
}) => {
  const layer = suggestionLayer(suggestion)
  return (
    <li className={`contextual-drawer-row${checked ? ' is-selected' : ''}`}>
      <label className="contextual-drawer-row-main">
        <input type="checkbox" checked={checked} disabled={busy} onChange={onToggle} />
        <span className="contextual-drawer-row-copy">
          <span className="contextual-drawer-row-label">{suggestion.label}</span>
          {suggestion.previewText ? (
            <span className="contextual-drawer-row-preview">{suggestion.previewText}</span>
          ) : null}
          <span className="contextual-drawer-row-meta">
            <span className="contextual-drawer-pill" data-layer={layer}>
              {layer}
            </span>
            <span>{suggestionCostLabel(suggestion)}</span>
          </span>
        </span>
      </label>
      <div className="contextual-drawer-row-actions">
        <button
          type="button"
          className="contextual-drawer-row-apply"
          disabled={busy}
          onClick={onApply}
        >
          {busy ? '…' : 'Apply'}
        </button>
        <button
          type="button"
          className="contextual-drawer-row-dismiss"
          disabled={busy}
          onClick={onDismiss}
          aria-label={`Dismiss ${suggestion.label}`}
        >
          Dismiss
        </button>
      </div>
    </li>
  )
}
