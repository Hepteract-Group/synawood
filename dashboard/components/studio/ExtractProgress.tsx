'use client'

import { useEffect, useState } from 'react'
import { StudioSpinner } from './StudioSpinner'

type ExtractJobState = {
  id: string
  status: string
  errorMessage?: string | null
}

type ExtractBriefPreview = {
  id: string
  productName?: string
  oneLiner?: string
  hooks?: string[]
}

type ExtractProgressProps = {
  job: ExtractJobState | null
  brief: ExtractBriefPreview | null
  modalOpen: boolean
  workerHint?: string | null
  applyPending?: boolean
  onDismissModal: () => void
  onReopenModal: () => void
  onRetry?: () => void
  onApply?: () => void
  onClearTerminal?: () => void
  /** Ready/failed banner hidden after Hide (persists across reload). */
  suppressed?: boolean
  onPersistDismiss?: (jobId: string) => void
}

const statusLabel = (status: string): string => {
  if (status === 'queued') return 'Queued, starting extract…'
  if (status === 'generating') return 'Extracting brief from source…'
  if (status === 'ready') return 'Brief ready'
  if (status === 'failed') return 'Extract failed'
  return status
}

const isActive = (status: string): boolean => status === 'queued' || status === 'generating'

export const ExtractProgress = ({
  job,
  brief,
  modalOpen,
  workerHint,
  applyPending = false,
  onDismissModal,
  onReopenModal,
  onRetry,
  onApply,
  onClearTerminal,
  suppressed = false,
  onPersistDismiss,
}: ExtractProgressProps) => {
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const active = Boolean(job && isActive(job.status))
  const ready = Boolean(job && job.status === 'ready')
  const failed = Boolean(job && job.status === 'failed')
  const terminal = failed

  useEffect(() => {
    if (active) setBannerDismissed(false)
  }, [active, job?.id])

  if (!job) return null
  if (suppressed && !active && !modalOpen) return null

  const showBanner = (active || ready || terminal) && !bannerDismissed && !suppressed

  if (!showBanner && !modalOpen) return null

  const persistHide = () => {
    setBannerDismissed(true)
    onDismissModal()
    onPersistDismiss?.(job.id)
  }

  const dismissTerminal = () => {
    persistHide()
    if (failed) onClearTerminal?.()
  }

  const dismissReady = () => {
    persistHide()
  }

  const banner = showBanner ? (
    <div
      className={`render-status-banner ${active ? 'is-active' : ready ? 'is-ready' : terminal ? 'is-failed' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="render-status-banner-main">
        {active ? <StudioSpinner size="sm" /> : null}
        <div className="render-status-banner-copy">
          <strong>{statusLabel(job.status)}</strong>
          {active ? (
            <span className="muted">
              {workerHint
                ? workerHint
                : 'Minimize this dialog. The banner stays until the brief is ready.'}
            </span>
          ) : null}
          {ready && brief ? (
            <span className="muted">
              {brief.productName ? `${brief.productName}: ` : ''}
              {brief.oneLiner ?? 'Apply to seed Brand Studio + hook/CTA overlays.'}
            </span>
          ) : null}
          {ready && job.errorMessage ? <span className="muted">{job.errorMessage}</span> : null}
          {failed && job.errorMessage ? <span className="error">{job.errorMessage}</span> : null}
        </div>
      </div>
      <div className="render-status-banner-actions">
        {!modalOpen && (active || ready) ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReopenModal}>
            Details
          </button>
        ) : null}
        {ready && onApply ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onApply}
            disabled={applyPending}
          >
            {applyPending ? 'Applying…' : 'Apply to project'}
          </button>
        ) : null}
        {ready ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={dismissReady}>
            Hide
          </button>
        ) : null}
        {terminal ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={dismissTerminal}>
            Hide
          </button>
        ) : null}
        {failed && onRetry ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    </div>
  ) : null

  const modal =
    modalOpen && (active || ready || (terminal && !bannerDismissed)) ? (
      <div className="dialog-root render-progress-modal" role="dialog" aria-modal="true">
        <button
          type="button"
          className="dialog-backdrop"
          onClick={active ? onDismissModal : failed ? dismissTerminal : dismissReady}
          aria-label={active ? 'Minimize extract progress' : 'Hide'}
        />
        <div className="dialog-panel render-progress-panel">
          {active ? <StudioSpinner size="lg" /> : null}
          {ready && !active ? (
            <div className="render-status-success-mark" aria-hidden>
              ✓
            </div>
          ) : null}
          {terminal ? (
            <div className="render-status-fail-mark" aria-hidden>
              !
            </div>
          ) : null}
          <h3 className="dialog-title">{statusLabel(job.status)}</h3>
          <div className="dialog-body">
            {active ? (
              <p>
                {workerHint
                  ? workerHint
                  : 'Fetching the source and filling a structured brief. Usually under a minute for a public URL.'}
              </p>
            ) : null}
            {ready ? (
              <>
                {brief?.productName ? <p>Product: {brief.productName}</p> : null}
                {brief?.oneLiner ? <p>{brief.oneLiner}</p> : null}
                {brief?.hooks?.length ? (
                  <p className="muted">Hooks: {brief.hooks.slice(0, 3).join(' · ')}</p>
                ) : null}
                <p className="muted">
                  Apply seeds Brand Studio (colors, name, CTA) and Path C hook/end-card overlays
                  (minimal first cut).
                </p>
                {job.errorMessage ? <p className="muted">{job.errorMessage}</p> : null}
              </>
            ) : null}
            {failed ? (
              <p>
                {job.errorMessage ?? 'Extract failed. Check the URL is public, then try again.'}
              </p>
            ) : null}
          </div>
          <div className="dialog-actions">
            {ready && onApply ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onApply}
                disabled={applyPending}
              >
                {applyPending ? 'Applying…' : 'Apply to project'}
              </button>
            ) : null}
            {failed && onRetry ? (
              <button type="button" className="btn btn-primary" onClick={onRetry}>
                Retry
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={active ? onDismissModal : failed ? dismissTerminal : dismissReady}
            >
              {active ? 'Minimize' : 'Hide'}
            </button>
          </div>
        </div>
      </div>
    ) : null

  return (
    <>
      {banner}
      {modal}
    </>
  )
}
