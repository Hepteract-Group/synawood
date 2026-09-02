'use client'

import { useState } from 'react'
import { IconCheck, IconDownload, IconFilm, IconTrash, IconUndo } from '../icons'
import { ApprovalStageTracker } from './ApprovalStageTracker'

export type ExportTargets = 'stills' | 'mp4' | 'both'

type Stage = { key: string; label: string; minRole: string }

type ReviewBarProps = {
  status: string
  renderActive: boolean
  onExport: (targets: ExportTargets) => void
  onReview?: (action: 'approve' | 'kill' | 'regenerate') => void
  pending: boolean
  reviewPending?: boolean
  /** Show stills/mp4/both selector (slideshow mode). */
  showExportTargets?: boolean
  /** Override Approve enablement (Campaign multi-Final). */
  approveEnabled?: boolean
  /** Tooltip when Approve is available or blocked. */
  approveHint?: string
  /** Signed MP4 URL after encode (#1271 / #1272). Compact download, not a banner. */
  downloadUrl?: string | null
  /** Multi-stage tracker (#316). */
  approvalStages?: Stage[]
  approvalStageIndex?: number
  approvalStatus?: string
}

export const ReviewBar = ({
  status,
  renderActive,
  onExport,
  onReview,
  pending,
  reviewPending = false,
  showExportTargets = false,
  approveEnabled,
  approveHint,
  downloadUrl = null,
  approvalStages = [],
  approvalStageIndex = 0,
  approvalStatus = 'open',
}: ReviewBarProps) => {
  const busy = pending || reviewPending
  const canApprove = approveEnabled ?? status === 'needs_review'
  const [targets, setTargets] = useState<ExportTargets>('both')
  return (
    <div className="review-bar" role="toolbar" aria-label="Review actions">
      {approvalStages.length > 0 ? (
        <ApprovalStageTracker
          stages={approvalStages}
          currentStageIndex={approvalStageIndex}
          status={approvalStatus}
          compact
        />
      ) : null}
      <div className="review-actions">
        {showExportTargets ? (
          <label className="review-export-targets">
            <span className="sr-only">Export targets</span>
            <select
              className="review-export-select"
              disabled={busy || renderActive}
              value={targets}
              aria-label="Export targets"
              onChange={(event) => setTargets(event.target.value as ExportTargets)}
            >
              <option value="both">Stills + MP4</option>
              <option value="stills">Stills only</option>
              <option value="mp4">MP4 only</option>
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="transport-icon-btn is-accent"
          onClick={() => onExport(showExportTargets ? targets : 'both')}
          disabled={busy || renderActive}
          aria-label={renderActive ? 'Exporting' : 'Export'}
          title={
            renderActive
              ? 'Export in progress…'
              : 'Encode a Final candidate. Download is the separate arrow when an MP4 is ready.'
          }
        >
          <IconFilm />
        </button>
        {downloadUrl ? (
          <a
            className="transport-icon-btn"
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            download
            aria-label="Download video"
            title="Download the encoded MP4"
          >
            <IconDownload />
          </a>
        ) : null}
        <button
          type="button"
          className="transport-icon-btn"
          disabled={busy || !onReview || !canApprove}
          aria-label="Approve"
          data-guide="approve"
          title={
            approveHint ?? (canApprove ? 'Open approval sign-off' : 'Export a candidate first')
          }
          onClick={() => onReview?.('approve')}
        >
          <IconCheck />
        </button>
        <button
          type="button"
          className="transport-icon-btn"
          disabled={busy || !onReview}
          aria-label="Back to draft"
          title="Return the project to Draft so you can re-cut and Export again"
          onClick={() => onReview?.('regenerate')}
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className="transport-icon-btn is-danger"
          disabled={busy || !onReview}
          aria-label="Discard"
          title="Discard this candidate for the content slot"
          onClick={() => onReview?.('kill')}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  )
}
