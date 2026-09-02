'use client'

import { useEffect, useRef, useState } from 'react'
import type { AdReadyIssue } from '@synawood/creative/project/ad-ready'
import type { StudioProjectCutReview } from '@synawood/creative/project/client'
import {
  hasCutReviewNotesContent,
  markCutReviewNotesDismissed,
  readCutReviewNotesDismissLevel,
  summarizeCutReviewNotes,
} from '@/lib/cut-review-notes'
import type { ChatSpendBlockReason } from '@/lib/chat-spend-send'
import { unseenFailedJobIds } from '@/lib/dismissed-failed-generation-jobs'
import {
  GENERATION_TOAST_MS,
  newInFlightJobIds,
  operatorFacingGenerationJobs,
  shouldShowGenerationToast,
  summarizeInFlightGeneration,
} from '@/lib/generation-progress-ui'
import { IconX } from '../icons'
import {
  failedGenerationJobs,
  formatGenerationJobLine,
  inFlightGenerationJobs,
  type GenerationJobSummary,
} from './useProjectGenerationJobs'

type WorkspaceStatusBannersProps = {
  jobs: GenerationJobSummary[]
  dismissedFailedIds: ReadonlySet<string>
  dismissalsReady: boolean
  onDismissFailed: (jobIds: string[]) => void
  adReadyIssues: AdReadyIssue[]
  showAdReady: boolean
  onOpenApprove?: () => void
  onInspectCut?: () => void
  inspectPending?: boolean
  showPlanBanner?: boolean
  onOpenPlan?: () => void
  /** Payment-failed freeze only — remaining pounds live under chat / Usage, not the player. */
  generationFrozen?: boolean
  /** Chat send blocked — Allow paid models is on but wallet/trial/freeze cannot run. */
  spendBlock?: ChatSpendBlockReason | null
  onClearSpendBlock?: () => void
}

type GenerationToast = {
  kind: 'inflight' | 'failed'
  text: string
}

export const WorkspaceStatusBanners = ({
  jobs,
  dismissedFailedIds,
  dismissalsReady,
  onDismissFailed,
  showPlanBanner = false,
  onOpenPlan,
  generationFrozen = false,
  spendBlock = null,
  onClearSpendBlock,
}: Omit<
  WorkspaceStatusBannersProps,
  'adReadyIssues' | 'showAdReady' | 'onOpenApprove' | 'onInspectCut' | 'inspectPending'
>) => {
  const inFlight = operatorFacingGenerationJobs(inFlightGenerationJobs(jobs))
  const failed = operatorFacingGenerationJobs(failedGenerationJobs(jobs)).filter(
    (job) => !dismissedFailedIds.has(job.id),
  )
  const [toast, setToast] = useState<GenerationToast | null>(null)
  const seenInFlightIdsRef = useRef<Set<string>>(new Set())
  const seenFailedIdsRef = useRef<Set<string>>(new Set())
  const inFlightKey = inFlight.map((job) => job.id).join('|')
  const failedKey = failed.map((job) => job.id).join('|')
  const inFlightSummary = summarizeInFlightGeneration(inFlight)
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs

  useEffect(() => {
    if (!dismissalsReady) return
    const currentInFlightIds = inFlightKey.length > 0 ? inFlightKey.split('|') : []
    const currentFailedIds = failedKey.length > 0 ? failedKey.split('|') : []
    const newIds = newInFlightJobIds(currentInFlightIds, seenInFlightIdsRef.current)
    const unseen = unseenFailedJobIds(currentFailedIds, seenFailedIdsRef.current)
    if (shouldShowGenerationToast({ newInFlightIds: newIds, unseenFailedIds: unseen })) {
      if (newIds.length > 0) {
        setToast({ kind: 'inflight', text: inFlightSummary })
      } else {
        const firstFailed = jobsRef.current.find((job) => unseen.includes(job.id))
        setToast({
          kind: 'failed',
          text: firstFailed
            ? formatGenerationJobLine(firstFailed)
            : 'Generation finished with errors',
        })
      }
    }
    for (const id of currentInFlightIds) seenInFlightIdsRef.current.add(id)
    for (const id of currentFailedIds) seenFailedIdsRef.current.add(id)
  }, [dismissalsReady, failedKey, inFlightKey, inFlightSummary])

  useEffect(() => {
    if (!toast || toast.kind !== 'inflight') return
    const timer = window.setTimeout(() => setToast(null), GENERATION_TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showFrozen = generationFrozen || spendBlock === 'frozen'
  const showInsufficient = spendBlock === 'insufficient'
  const showTrialVideo = spendBlock === 'trial_paid_video'

  if (
    inFlight.length === 0 &&
    failed.length === 0 &&
    !toast &&
    !showPlanBanner &&
    !showFrozen &&
    !showInsufficient &&
    !showTrialVideo
  ) {
    return null
  }

  return (
    <div className="workspace-status-stack" aria-label="Studio status">
      {showFrozen ? (
        <div className="workspace-status-banner is-failed" role="alert">
          <div className="workspace-status-copy">
            <strong>Generation paused</strong>
            <span className="muted"> We could not take payment. Update payment to generate.</span>
          </div>
          <a href="/settings/billing" className="btn btn-primary btn-sm">
            Update payment
          </a>
        </div>
      ) : null}

      {showInsufficient ? (
        <div className="workspace-status-banner is-failed" role="alert">
          <div className="workspace-status-copy">
            <strong>Not enough credits</strong>
            <span className="muted"> Buy credits to run paid generation.</span>
          </div>
          <a href="/settings/billing" className="btn btn-primary btn-sm">
            Buy credits
          </a>
          {onClearSpendBlock ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClearSpendBlock}>
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}

      {showTrialVideo ? (
        <div className="workspace-status-banner is-failed" role="alert">
          <div className="workspace-status-copy">
            <strong>Paid video is off on the trial</strong>
            <span className="muted"> Upload a talking-head take, or use stills.</span>
          </div>
          <a href="/pricing" className="btn btn-ghost btn-sm">
            See plans
          </a>
          {onClearSpendBlock ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClearSpendBlock}>
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}

      {toast ? (
        <div className="generation-toast-layer">
          <div
            className={`generation-toast ${toast.kind === 'failed' ? 'is-failed' : 'is-busy'}`}
            role={toast.kind === 'failed' ? 'alert' : 'status'}
            aria-live={toast.kind === 'failed' ? 'assertive' : 'polite'}
          >
            <span className="generation-toast-pulse" aria-hidden />
            <div className="generation-toast-copy">
              <p className="generation-toast-title">{toast.text}</p>
              {toast.kind === 'inflight' ? (
                <p className="generation-toast-hint">You can keep editing.</p>
              ) : null}
            </div>
            <button
              type="button"
              className="generation-toast-dismiss"
              aria-label="Dismiss generation notice"
              onClick={() => setToast(null)}
            >
              <IconX />
            </button>
          </div>
        </div>
      ) : null}

      {showPlanBanner ? (
        <div className="workspace-status-banner is-plan" role="status">
          <div className="workspace-status-copy">
            <strong>Plan ready</strong>
            <span className="muted"> — confirm to generate.</span>
          </div>
          {onOpenPlan ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={onOpenPlan}>
              Review plan
            </button>
          ) : null}
        </div>
      ) : null}

      {inFlight.length > 0 ? (
        <div className="workspace-status-banner is-busy" role="status" aria-busy>
          <div className="workspace-status-copy">
            <strong>{inFlightSummary}</strong>
            <span className="muted"> You can keep editing.</span>
          </div>
        </div>
      ) : null}

      {failed.map((job) => (
        <div key={job.id} className="workspace-status-banner is-failed" role="alert">
          <div className="workspace-status-copy">
            <strong>{formatGenerationJobLine(job)}</strong>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onDismissFailed([job.id])}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}

export const CutReviewNotesBanner = ({
  projectId,
  cutReview,
}: {
  projectId: string
  cutReview?: StudioProjectCutReview | null
}) => {
  const reviewAt = cutReview?.at ?? ''
  const hasContent = hasCutReviewNotesContent(cutReview)
  const [dismissLevel, setDismissLevel] = useState<'none' | 'banner' | 'all'>('none')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!reviewAt) {
      setDismissLevel('none')
      setExpanded(false)
      return
    }
    setDismissLevel(readCutReviewNotesDismissLevel(projectId, reviewAt))
    setExpanded(false)
  }, [projectId, reviewAt])

  if (!hasContent || !cutReview || dismissLevel === 'all') return null

  const { failedChecks, notes } = summarizeCutReviewNotes(cutReview)
  const showBanner = dismissLevel === 'none' || expanded

  return (
    <>
      {dismissLevel === 'banner' && !expanded ? (
        <div className="cut-review-notes-toggle-row">
          <button
            type="button"
            className="cut-review-notes-toggle"
            aria-label="Show last cut review notes"
            onClick={() => setExpanded(true)}
          >
            Review notes
          </button>
          <button
            type="button"
            className="cut-review-notes-dismiss"
            aria-label="Hide review notes"
            onClick={() => {
              markCutReviewNotesDismissed(projectId, reviewAt, 'all')
              setDismissLevel('all')
            }}
          >
            <IconX />
          </button>
        </div>
      ) : null}
      {showBanner ? (
        <div
          className={`cut-review-notes-banner ${cutReview.passed ? 'is-pass' : 'is-fail'}`}
          role="status"
        >
          <div className="cut-review-notes-copy">
            <strong>{cutReview.passed ? 'Last inspect passed' : 'Last inspect failed'}</strong>
            {failedChecks ? (
              <span className="cut-review-notes-failed">Failed: {failedChecks}</span>
            ) : null}
            {notes ? <span className="cut-review-notes-text">{notes}</span> : null}
          </div>
          <button
            type="button"
            className="cut-review-notes-dismiss"
            aria-label="Dismiss cut review notes"
            onClick={() => {
              markCutReviewNotesDismissed(projectId, reviewAt, 'banner')
              setDismissLevel('banner')
              setExpanded(false)
            }}
          >
            <IconX />
          </button>
        </div>
      ) : null}
    </>
  )
}

/** Compact overlay on the player — not a full-width bar under the canvas (#1272). */
export const AdReadyChip = ({
  adReadyIssues,
  showAdReady,
  onOpenApprove,
  onInspectCut,
  inspectPending = false,
}: Pick<
  WorkspaceStatusBannersProps,
  'adReadyIssues' | 'showAdReady' | 'onOpenApprove' | 'onInspectCut' | 'inspectPending'
>) => {
  if (!showAdReady) return null
  const ready = adReadyIssues.length === 0
  const needsInspect = adReadyIssues.some((issue) => issue.code === 'cut_review')
  const other = adReadyIssues.find((issue) => issue.code !== 'cut_review')
  const title = ready ? 'Ready' : needsInspect ? 'Needs inspect' : 'Can’t Approve'
  return (
    <div className={`ad-ready-chip ${ready ? 'is-ready' : 'is-blocked'}`} role="status">
      <strong>{title}</strong>
      {other && !needsInspect ? <span className="ad-ready-chip-hint">{other.message}</span> : null}
      {ready && onOpenApprove ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenApprove}>
          Approve
        </button>
      ) : null}
      {!ready && needsInspect && onInspectCut ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onInspectCut}
          disabled={inspectPending}
        >
          {inspectPending ? 'Inspecting…' : 'Inspect'}
        </button>
      ) : null}
    </div>
  )
}
