'use client'

// Client-safe: do not import `@synawood/creative/brief` barrel (re-exports apply-brief → node:crypto).
import { parseExtractedBrief, type ExtractedBrief } from '@synawood/creative/brief/extracted-brief'
import { estimateExtractGbp } from '@synawood/creative/generation-jobs/estimate-extract'
import {
  EXTRACT_REASONER_OPTIONS,
  resolveExtractReasonerId,
} from '@synawood/creative/model-profiles'
import type { StudioProject } from '@synawood/creative/project/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BriefReviewForm } from './BriefReviewForm'
import { adoptProjectLogoIfCorrected, sameExtractJob } from './brief-review-draft'
import { StudioSpinner } from './StudioSpinner'
import { useBriefAutosave } from './useBriefAutosave'
import type { GalleryAsset } from './AssetLibrary'

type WizardStep = 'source' | 'extracting' | 'review' | 'applying'

type ExtractJobState = {
  id: string
  status: string
  errorMessage?: string | null
}

type AdGeneratorWizardProps = {
  projectId: string
  projectRevision: number
  projectAssets: GalleryAsset[]
  /** Logo currently on the project (e.g. Brand Studio correction before Apply). */
  projectLogoAssetId?: string | null
  reasonerModelId: string | null
  reasonerSaving?: boolean
  open: boolean
  onClose: () => void
  onReasonerChange: (reasonerModelId: string) => void
  onApplied: (project: StudioProject, modeUsed: string) => void
  onProjectRevision: (revision: number) => void
  onProjectChanged: () => void
  /** Keep workspace banner/reload recovery in sync with wizard extract jobs. */
  onJobChange?: (job: ExtractJobState | null) => void
  onWorkerHint?: (hint: string | null) => void
  initialUrl?: string
  initialSource?: 'url' | 'pdf'
}

const isActiveStatus = (status: string): boolean => status === 'queued' || status === 'generating'

export const AdGeneratorWizard = ({
  projectId,
  projectRevision,
  projectAssets,
  projectLogoAssetId,
  reasonerModelId,
  reasonerSaving,
  open,
  onClose,
  onReasonerChange,
  onApplied,
  onProjectRevision,
  onProjectChanged,
  onJobChange,
  onWorkerHint,
  initialUrl,
  initialSource,
}: AdGeneratorWizardProps) => {
  const [step, setStep] = useState<WizardStep>('source')
  const [sourceKind, setSourceKind] = useState<'url' | 'pdf'>(
    initialSource === 'pdf' ? 'pdf' : 'url',
  )
  const [url, setUrl] = useState(initialUrl ?? '')
  const [pdfName, setPdfName] = useState<string | null>(null)
  const [pdfBlobKey, setPdfBlobKey] = useState<string | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [job, setJob] = useState<ExtractJobState | null>(null)
  const [briefId, setBriefId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ExtractedBrief | null>(null)
  const [workerHint, setWorkerHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const extractReasoner = resolveExtractReasonerId(reasonerModelId)
  const reasonLabel =
    EXTRACT_REASONER_OPTIONS.find((option) => option.id === extractReasoner)?.label ??
    extractReasoner
  const estimatedGbp = estimateExtractGbp(extractReasoner, { sourceKind })

  const jobRef = useRef(job)
  jobRef.current = job

  const syncJob = useCallback(
    (next: ExtractJobState | null) => {
      if (sameExtractJob(jobRef.current, next)) return
      jobRef.current = next
      setJob(next)
      onJobChange?.(next)
    },
    [onJobChange],
  )

  const {
    status: saveStatus,
    flush: flushBriefSave,
    resetBaseline,
  } = useBriefAutosave({
    projectId,
    briefId,
    draft,
    enabled: open && step === 'review',
  })

  const hydrateFromServer = useCallback(async () => {
    const response = await fetch(`/api/studio/projects/${projectId}/extract`)
    const body = (await response.json()) as {
      job?: ExtractJobState | null
      brief?: { id: string; brief: unknown } | null
      applied?: boolean
      error?: string
    }
    if (!response.ok) throw new Error(body.error ?? 'Failed to load extract status')
    if (body.job && isActiveStatus(body.job.status)) {
      syncJob(body.job)
      setStep('extracting')
      return
    }
    if (body.applied) {
      syncJob(null)
      setStep('source')
      return
    }
    if (body.job?.status === 'ready' && body.brief) {
      syncJob(body.job)
      setBriefId(body.brief.id)
      const rawBrief = parseExtractedBrief(body.brief.brief)
      const reviewBrief = adoptProjectLogoIfCorrected(rawBrief, projectLogoAssetId)
      // Baseline the server row so a Brand Studio logo correction is treated as dirty and autosaved.
      resetBaseline(rawBrief)
      setDraft(reviewBrief)
      setStep('review')
      return
    }
    if (body.job?.status === 'failed') {
      syncJob(body.job)
      setStep('extracting')
    }
  }, [projectId, projectLogoAssetId, syncJob, resetBaseline])

  const hydrateRef = useRef(hydrateFromServer)
  hydrateRef.current = hydrateFromServer

  // Hydrate only when the dialog opens (or project changes) — not whenever parent
  // callback identity churns from StudioWorkspace re-renders.
  useEffect(() => {
    if (!open) return
    setError(null)
    setDraft(null)
    setBriefId(null)
    resetBaseline(null)
    void hydrateRef.current().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to restore extract state')
    })
  }, [open, projectId, resetBaseline])

  useEffect(() => {
    if (!open || !job || !isActiveStatus(job.status)) return
    const timer = window.setInterval(() => {
      void (async () => {
        const response = await fetch(`/api/studio/generation/${job.id}`)
        const body = (await response.json()) as {
          job?: ExtractJobState
          brief?: { id: string; brief: unknown } | null
          error?: string
        }
        if (!response.ok || !body.job) return
        syncJob(body.job)
        if (body.job.status === 'ready' && body.brief) {
          setBriefId(body.brief.id)
          const rawBrief = parseExtractedBrief(body.brief.brief)
          const readyBrief = adoptProjectLogoIfCorrected(rawBrief, projectLogoAssetId)
          resetBaseline(rawBrief)
          setDraft(readyBrief)
          setStep('review')
          setBusy(false)
          onProjectChanged()
        }
        if (body.job.status === 'failed') {
          setBusy(false)
        }
      })()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [open, job, syncJob, projectLogoAssetId, resetBaseline, onProjectChanged])

  const enqueue = async () => {
    setBusy(true)
    setError(null)
    setWorkerHint(null)
    try {
      const payload =
        sourceKind === 'url'
          ? { sourceKind: 'url' as const, url: url.trim() }
          : { sourceKind: 'pdf' as const, blobKey: pdfBlobKey! }
      const response = await fetch(`/api/studio/projects/${projectId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await response.json()) as {
        job?: ExtractJobState
        workerHint?: string | null
        error?: string
      }
      if (!response.ok || !body.job) {
        throw new Error(body.error ?? 'Failed to start extract')
      }
      syncJob(body.job)
      setDraft(null)
      setBriefId(null)
      const hint = body.workerHint ?? null
      setWorkerHint(hint)
      onWorkerHint?.(hint)
      setStep('extracting')
      setBusy(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start extract')
      setBusy(false)
    }
  }

  const onStartExtract = () => {
    if (sourceKind === 'url' && !url.trim()) {
      setError('Paste a public product URL.')
      return
    }
    if (sourceKind === 'pdf' && !pdfBlobKey) {
      setError('Upload a PDF first.')
      return
    }
    void enqueue()
  }

  const onUploadPdf = async (file: File | null) => {
    if (!file) return
    setUploadingPdf(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('projectId', projectId)
      form.set('expectedRevision', String(projectRevision))
      form.set('addAsClip', 'false')
      form.set('file', file)
      const response = await fetch('/api/studio/assets', {
        method: 'POST',
        body: form,
      })
      const body = (await response.json()) as {
        asset?: { blobKey: string }
        project?: { revision: number }
        error?: string
      }
      if (!response.ok || !body.asset) {
        throw new Error(body.error ?? 'Failed to upload PDF')
      }
      setPdfBlobKey(body.asset.blobKey)
      setPdfName(file.name)
      if (body.project?.revision) onProjectRevision(body.project.revision)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload PDF')
    } finally {
      setUploadingPdf(false)
    }
  }

  const onApply = async () => {
    if (!draft || !briefId) return
    setStep('applying')
    setBusy(true)
    setError(null)
    try {
      await flushBriefSave()

      const response = await fetch(`/api/studio/projects/${projectId}/apply-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId,
          firstCutMode: 'minimal',
          expectedRevision: projectRevision,
        }),
      })
      const body = (await response.json()) as {
        project?: StudioProject
        modeUsed?: string
        warning?: string | null
        error?: string
      }
      if (!response.ok || !body.project) {
        throw new Error(body.error ?? 'Failed to apply brief')
      }
      onApplied(body.project, body.modeUsed ?? 'minimal')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply brief')
      setStep('review')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const canExtract =
    sourceKind === 'url' ? Boolean(url.trim()) : Boolean(pdfBlobKey) && !uploadingPdf
  const compact = step !== 'review'

  return (
    <div
      className="dialog-root brand-studio-root ad-generator-root"
      role="dialog"
      aria-modal="true"
      aria-label="Ad Generator"
    >
      <button type="button" className="dialog-backdrop" onClick={onClose} aria-label="Close" />
      <div
        className={`dialog-panel brand-studio-panel ad-generator-panel${compact ? ' is-compact' : ' is-roomy'}`}
      >
        <header className="brand-studio-header">
          <div>
            <p className="eyebrow">Ad Generator</p>
            <h2>
              {step === 'source'
                ? 'Start from a URL or PDF'
                : step === 'extracting'
                  ? 'Extracting brief…'
                  : step === 'review'
                    ? 'Review brief'
                    : 'Applying…'}
            </h2>
            <p className="muted ad-generator-lede">
              {step === 'source'
                ? 'We’ll pull brand and copy into a brief, then seed the first cut.'
                : step === 'extracting'
                  ? 'Close to minimize — progress stays on the page until the brief is ready.'
                  : step === 'review'
                    ? 'Check low-confidence fields, then apply to seed brand + opening line + CTA.'
                    : 'Writing brand and first-cut overlays onto this project.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={step === 'applying'}
          >
            Close
          </button>
        </header>

        <div className="ad-generator-body">
          <ol className="ad-generator-steps" aria-label="Wizard progress">
            {(
              [
                ['source', 'Source'],
                ['extracting', 'Extract'],
                ['review', 'Review'],
                ['applying', 'Apply'],
              ] as const
            ).map(([id, label], index) => {
              const order = ['source', 'extracting', 'review', 'applying'] as const
              const current = order.indexOf(step)
              const done = index < current
              const active = id === step
              return (
                <li
                  key={id}
                  className={`ad-generator-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                >
                  <span className="ad-generator-step-num" aria-hidden>
                    {done ? '✓' : index + 1}
                  </span>
                  {label}
                </li>
              )
            })}
          </ol>

          {step === 'source' ? (
            <section className="ad-generator-source" aria-labelledby="ad-gen-source">
              <h3 id="ad-gen-source" className="sr-only">
                Choose source
              </h3>
              <div className="ad-generator-source-toolbar">
                <div className="ad-generator-source-tabs" role="tablist" aria-label="Source type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceKind === 'url'}
                    className={`ad-generator-tab${sourceKind === 'url' ? ' is-selected' : ''}`}
                    onClick={() => setSourceKind('url')}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sourceKind === 'pdf'}
                    className={`ad-generator-tab${sourceKind === 'pdf' ? ' is-selected' : ''}`}
                    onClick={() => setSourceKind('pdf')}
                  >
                    PDF
                  </button>
                </div>
                <label className="ad-generator-reasoner">
                  <span className="sr-only">Reason model</span>
                  <select
                    aria-label="Reason model"
                    className="extract-source-select"
                    value={extractReasoner}
                    disabled={busy || reasonerSaving}
                    onChange={(event) => onReasonerChange(event.target.value)}
                  >
                    {EXTRACT_REASONER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {sourceKind === 'url' ? (
                <div className="ad-generator-source-row">
                  <input
                    type="url"
                    className="extract-source-input"
                    aria-label="Product URL"
                    placeholder="https://…"
                    value={url}
                    disabled={busy}
                    onChange={(event) => setUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && canExtract && !busy) {
                        event.preventDefault()
                        onStartExtract()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canExtract || busy || uploadingPdf}
                    onClick={onStartExtract}
                  >
                    {busy ? 'Starting…' : 'Extract'}
                  </button>
                </div>
              ) : (
                <div className="ad-generator-source-row">
                  <label className={`ad-generator-file${pdfName ? ' is-ready' : ''}`}>
                    <input
                      type="file"
                      className="sr-only"
                      accept="application/pdf,.pdf"
                      disabled={busy || uploadingPdf}
                      aria-label="PDF brochure"
                      onChange={(event) => void onUploadPdf(event.target.files?.[0] ?? null)}
                    />
                    <span className="ad-generator-file-face">
                      {uploadingPdf ? 'Uploading…' : pdfName ? pdfName : 'Choose PDF'}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canExtract || busy || uploadingPdf}
                    onClick={onStartExtract}
                  >
                    {busy ? 'Starting…' : 'Extract'}
                  </button>
                </div>
              )}

              <p className="ad-generator-credit-hint muted" role="status">
                {sourceKind === 'pdf'
                  ? 'PDF extract is free in v1 (no vision).'
                  : `Uses a small amount of credits · ${reasonLabel} · ~£${estimatedGbp.toFixed(2)}`}
              </p>
              {error ? (
                <p className="error ad-generator-source-error" role="alert">
                  {error}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === 'extracting' && job ? (
            <section className="ad-generator-extracting" aria-live="polite">
              {isActiveStatus(job.status) ? (
                <div className="ad-generator-busy">
                  <StudioSpinner size="lg" />
                  <p>
                    {job.status === 'queued'
                      ? 'Queued — starting extract…'
                      : 'Extracting brief from source…'}
                  </p>
                  {workerHint ? <p className="muted">{workerHint}</p> : null}
                  <p className="muted">
                    Minimize with Close — reopen Ad Generator anytime; we’ll resume from the server.
                  </p>
                </div>
              ) : null}
              {job.status === 'failed' ? (
                <div className="ad-generator-failed">
                  <p className="error">{job.errorMessage ?? 'Extract failed.'}</p>
                  <div className="ad-generator-actions">
                    <button type="button" className="btn btn-primary" onClick={onStartExtract}>
                      Retry
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setStep('source')}
                    >
                      Change source
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {step === 'review' && draft ? (
            <section className="ad-generator-review">
              <BriefReviewForm
                brief={draft}
                onChange={setDraft}
                disabled={busy}
                projectId={projectId}
                projectRevision={projectRevision}
                assets={projectAssets}
                onProjectChanged={onProjectChanged}
              />
              <div className="ad-generator-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || saveStatus === 'saving'}
                  onClick={() => void onApply()}
                >
                  Apply to project
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setStep('source')
                    setJob(null)
                    setDraft(null)
                    setBriefId(null)
                    resetBaseline(null)
                  }}
                >
                  Re-extract
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
                  Discard
                </button>
              </div>
              <p className="brief-review-save-status muted" role="status">
                {saveStatus === 'saving'
                  ? 'Saving edits…'
                  : saveStatus === 'saved'
                    ? 'Edits saved.'
                    : saveStatus === 'error'
                      ? 'Couldn’t save edits — try again or Apply to retry.'
                      : 'Edits auto-save to this brief.'}
              </p>
            </section>
          ) : null}

          {step === 'applying' ? (
            <div className="ad-generator-busy" aria-live="polite">
              <StudioSpinner size="lg" />
              <p>Applying brief to this project…</p>
            </div>
          ) : null}

          {error && step !== 'source' ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
