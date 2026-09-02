'use client'

import {
  EXTRACT_REASONER_OPTIONS,
  resolveExtractReasonerId,
} from '@synawood/creative/model-profiles'
import { estimateExtractGbp } from '@synawood/creative/generation-jobs/estimate-extract'
import { presentStudioError } from '@/lib/humanize-studio-error'

type ExtractSourceBarProps = {
  url: string
  pending: boolean
  disabled?: boolean
  reasonerModelId?: string | null
  reasonerSaving?: boolean
  onUrlChange: (value: string) => void
  onReasonerChange?: (reasonerModelId: string) => void
  onExtract: () => void
  error?: string | null
}

/** Brand Studio shortcut; primary path is Ad Generator wizard (#156). */
export const ExtractSourceBar = ({
  url,
  pending,
  disabled,
  reasonerModelId,
  reasonerSaving,
  onUrlChange,
  onReasonerChange,
  onExtract,
  error,
}: ExtractSourceBarProps) => {
  const selectedReasoner = resolveExtractReasonerId(reasonerModelId)
  const estimatedGbp = estimateExtractGbp(selectedReasoner, { sourceKind: 'url' })
  const reasonLabel =
    EXTRACT_REASONER_OPTIONS.find((option) => option.id === selectedReasoner)?.label ??
    selectedReasoner
  const creditAction = error ? presentStudioError(error).action : undefined

  return (
    <div className="extract-source-bar" aria-label="Extract brief from URL">
      <label className="extract-source-label extract-source-reason">
        <span className="muted">Reason model</span>
        <select
          aria-label="Reason model for extract"
          className="extract-source-select"
          value={selectedReasoner}
          disabled={disabled || pending || reasonerSaving || !onReasonerChange}
          onChange={(event) => onReasonerChange?.(event.target.value)}
        >
          {EXTRACT_REASONER_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="extract-source-label">
        <span className="muted">Product URL</span>
        <input
          type="url"
          className="extract-source-input"
          placeholder="https://…"
          value={url}
          disabled={disabled || pending}
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && url.trim() && !pending && !disabled) {
              event.preventDefault()
              onExtract()
            }
          }}
        />
      </label>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={disabled || pending || !url.trim()}
        onClick={onExtract}
      >
        Extract
      </button>
      <p className="extract-source-hint muted" role="status">
        Uses {reasonLabel}. A small credit charge applies (~£{estimatedGbp.toFixed(2)}).
      </p>
      {error ? (
        <div className="extract-source-error-row" role="alert">
          <p className="error extract-source-error">{error}</p>
          {creditAction ? (
            <a href={creditAction.href} className="btn btn-primary btn-sm">
              {creditAction.label}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
