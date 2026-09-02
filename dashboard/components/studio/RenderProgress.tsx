'use client'

import { useEffect, useState } from 'react'
import { StudioSpinner } from './StudioSpinner'

type RenderJobState = {
  id: string
  status: string
  errorMessage?: string | null
}

type RenderProgressProps = {
  job: RenderJobState | null
  projectStatus: string
  durationFrames?: number
  fps?: number
  modalOpen: boolean
  cancelPending?: boolean
  downloadUrl?: string | null
  /** Persisted dismiss (localStorage). Ready banner stays gone after reload. */
  persistDismissed?: boolean
  onDismissModal: () => void
  onReopenModal: () => void
  onCancel: () => void
  /** Persist ready-banner dismiss without dropping the download URL. */
  onPersistDismiss?: () => void
  /** Clear terminal states (cancelled / failed) from the UI after dismiss. */
  onClearTerminal?: () => void
}

const statusLabel = (
  status: string,
  errorMessage?: string | null,
  projectStatus?: string,
): string => {
  if (status === 'queued') return 'Queued — starting encode…'
  if (status === 'rendering') return 'Rendering your export…'
  if (status === 'completed') {
    if (projectStatus === 'approved') return 'Export retained as Final'
    if (projectStatus === 'killed') return 'Export discarded with candidate'
    return 'Export complete — ready for review'
  }
  if (status === 'failed' && errorMessage?.toLowerCase().includes('cancel')) {
    return 'Export cancelled'
  }
  if (status === 'failed') return 'Export failed'
  return status
}

const isActive = (status: string): boolean => status === 'queued' || status === 'rendering'

const formatDuration = (frames: number, fps: number): string => {
  const totalSec = Math.max(0, Math.round(frames / Math.max(1, fps)))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export const RenderProgress = ({
  job,
  projectStatus,
  durationFrames = 0,
  fps = 30,
  modalOpen,
  cancelPending = false,
  downloadUrl = null,
  persistDismissed = false,
  onDismissModal,
  onReopenModal,
  onCancel,
  onPersistDismiss,
  onClearTerminal,
}: RenderProgressProps) => {
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const active = Boolean(job && isActive(job.status))
  const cancelled = Boolean(
    job && job.status === 'failed' && (job.errorMessage?.toLowerCase().includes('cancel') ?? false),
  )
  // Only nudge Approve while the project is still in needs_review. After Approve /
  // Discard the completed job must not keep saying "ready for review".
  const ready = Boolean(
    job && !cancelled && job.status === 'completed' && projectStatus === 'needs_review',
  )
  const failed = Boolean(job && job.status === 'failed' && !cancelled)
  const terminal = cancelled || failed
  const longCut = durationFrames / Math.max(1, fps) > 90
  const postReview =
    job?.status === 'completed' && (projectStatus === 'approved' || projectStatus === 'killed')

  // Reset dismiss when a new active job starts.
  useEffect(() => {
    if (active) setBannerDismissed(false)
  }, [active, job?.id])

  // Drop the export banner once the founder has Approved or Discarded.
  useEffect(() => {
    if (postReview) {
      setBannerDismissed(true)
      onClearTerminal?.()
    }
  }, [postReview, job?.id, onClearTerminal])

  // Auto-dismiss cancelled/failed banners after 5s.
  useEffect(() => {
    if (!terminal || bannerDismissed) return
    const timer = window.setTimeout(() => {
      setBannerDismissed(true)
      onDismissModal()
      onClearTerminal?.()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [terminal, bannerDismissed, job?.id, onDismissModal, onClearTerminal])

  if (!job) return null

  const hideReady = persistDismissed || bannerDismissed
  const showBanner = (active || (ready && !hideReady) || terminal) && !bannerDismissed

  if (!showBanner && !modalOpen) return null

  const dismissReady = () => {
    setBannerDismissed(true)
    onDismissModal()
    onPersistDismiss?.()
  }

  const dismissTerminal = () => {
    setBannerDismissed(true)
    onDismissModal()
    onClearTerminal?.()
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
          <strong>{statusLabel(job.status, job.errorMessage, projectStatus)}</strong>
          {active ? (
            <span className="muted">
              {longCut
                ? `This cut is ~${formatDuration(durationFrames, fps)} — encode can take a long time. Cancel anytime to keep editing.`
                : 'Encoding on this machine. Minimize this dialog — the banner stays until Approve is ready.'}
            </span>
          ) : null}
          {cancelled ? (
            <span className="muted">Export stopped. Trim the timeline and try Export again.</span>
          ) : null}
          {failed && job.errorMessage ? <span className="error">{job.errorMessage}</span> : null}
        </div>
      </div>
      <div className="render-status-banner-actions">
        {active ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            disabled={cancelPending}
          >
            {cancelPending ? 'Cancelling…' : 'Cancel export'}
          </button>
        ) : null}
        {ready && downloadUrl ? (
          <a
            className="btn btn-ghost btn-sm"
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            download
          >
            Download video
          </a>
        ) : null}
        {ready ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={dismissReady}>
            Dismiss
          </button>
        ) : null}
        {!modalOpen && active ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReopenModal}>
            Details
          </button>
        ) : null}
        {terminal ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={dismissTerminal}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  ) : null

  const modal =
    modalOpen && (active || (ready && !hideReady) || (terminal && !bannerDismissed)) ? (
      <div className="dialog-root render-progress-modal" role="dialog" aria-modal="true">
        <button
          type="button"
          className="dialog-backdrop"
          onClick={active || ready ? onDismissModal : dismissTerminal}
          aria-label={active || ready ? 'Minimize export progress' : 'Dismiss'}
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
          <h3 className="dialog-title">
            {statusLabel(job.status, job.errorMessage, projectStatus)}
          </h3>
          <p className="dialog-body">
            {active
              ? longCut
                ? `This project is ~${formatDuration(durationFrames, fps)} long. Encoding hour-scale cuts is slow — cancel if you meant a short ad, trim the timeline, then Export again.`
                : 'Encoding usually takes 30–90 seconds for a ≤60s cut. Keep this tab open or minimize — the banner stays visible while we work.'
              : ready
                ? 'Your export finished. Download the MP4 now, or close this and click Approve to keep a Final on the Work board.'
                : cancelled
                  ? 'Export cancelled. You can keep editing; click Export when you are ready again.'
                  : (job.errorMessage ??
                    'Something went wrong during encode. Try Export again or check terminal logs.')}
          </p>
          <div className="dialog-actions">
            {active ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={cancelPending}
              >
                {cancelPending ? 'Cancelling…' : 'Cancel export'}
              </button>
            ) : null}
            {ready && downloadUrl ? (
              <a
                className="btn btn-primary"
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                download
              >
                Download video
              </a>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={active || ready ? onDismissModal : dismissTerminal}
            >
              {active || ready ? 'Minimize' : 'Dismiss'}
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
