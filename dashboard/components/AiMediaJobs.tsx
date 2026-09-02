'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { humanizeStudioError } from '@/lib/humanize-studio-error'
import { readActiveProductIdFromDocument } from '@/lib/active-product-cookie'
import {
  jobCanPlace,
  playableJobKind,
  previewUrlForJob,
  retryNeedsConfirm,
  studioHrefForJob,
} from '@/lib/ai-media-review'
import { useRouter } from 'next/navigation'

export type AiMediaJob = {
  id: string
  status: 'queued' | 'generating' | 'ready' | 'failed'
  role: string
  errorMessage: string | null
  estimatedGbp: number | null
  actualGbp: number | null
  projectId: string | null
  outputAssetId: string | null
  outputKind: string | null
  createdAt: string | null
}

const roleLabel = (role: string): string => {
  if (role === 'video') return 'Video clip'
  if (role === 'music') return 'Music bed'
  if (role === 'image') return 'Image'
  if (role === 'speech' || role.startsWith('voice_')) return 'Voice'
  if (role === 'extract') return 'Extract'
  if (role === 'index') return 'Index'
  if (role === 'transcribe') return 'Transcript'
  if (role === 'speech_enhance') return 'Speech enhance'
  if (role === 'reframe') return 'Reframe'
  return role.replaceAll('_', ' ')
}

const statusLabel = (status: AiMediaJob['status']): string => {
  if (status === 'queued') return 'Queued'
  if (status === 'generating') return 'Running'
  if (status === 'ready') return 'Ready'
  return 'Failed'
}

const formatWhen = (iso: string | null): string => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatGbp = (value: number | null): string | null => {
  if (value === null || !Number.isFinite(value)) return null
  return `£${value.toFixed(2)}`
}

export const AiMediaJobs = () => {
  const router = useRouter()
  const [productId, setProductId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<AiMediaJob[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null)
  const [pendingRetryId, setPendingRetryId] = useState<string | null>(null)
  const [confirmRetry, setConfirmRetry] = useState<AiMediaJob | null>(null)
  const [retryModalOpen, setRetryModalOpen] = useState(false)

  const load = useCallback(async (id: string) => {
    const response = await fetch(
      `/api/studio/generation-jobs?productId=${encodeURIComponent(id)}`,
      {
        credentials: 'same-origin',
      },
    )
    const body = (await response.json().catch(() => ({}))) as {
      jobs?: AiMediaJob[]
      error?: string
    }
    if (!response.ok) throw new Error(body.error ?? 'Failed to load generation jobs')
    setJobs(body.jobs ?? [])
  }, [])

  useEffect(() => {
    const id = readActiveProductIdFromDocument()
    setProductId(id)
    if (!id) {
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    const refresh = async () => {
      try {
        await load(id)
        if (!cancelled) setError(null)
      } catch (err) {
        if (!cancelled) {
          setError(humanizeStudioError(err instanceof Error ? err.message : 'Failed to load'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [load])

  const placeJob = async (job: AiMediaJob) => {
    setActionError(null)
    setPendingPlaceId(job.id)
    try {
      const response = await fetch(`/api/studio/generation/${encodeURIComponent(job.id)}/place`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string; href?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not place in Studio.')
      if (body.href) router.push(body.href)
    } catch (err) {
      setActionError(humanizeStudioError(err instanceof Error ? err.message : 'Place failed.'))
    } finally {
      setPendingPlaceId(null)
    }
  }

  const retryJob = async (job: AiMediaJob, confirmSpend: boolean) => {
    setActionError(null)
    setPendingRetryId(job.id)
    setRetryModalOpen(true)
    try {
      const response = await fetch(`/api/studio/generation/${encodeURIComponent(job.id)}/retry`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmSpend }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        needsConfirm?: boolean
        estimatedGbp?: number
      }
      if (response.status === 402 || body.needsConfirm) {
        setConfirmRetry(job)
        setRetryModalOpen(false)
        return
      }
      if (!response.ok) throw new Error(body.error ?? 'Could not retry.')
      if (productId) await load(productId)
    } catch (err) {
      setActionError(humanizeStudioError(err instanceof Error ? err.message : 'Retry failed.'))
    } finally {
      setPendingRetryId(null)
      setRetryModalOpen(false)
    }
  }

  const inFlight = jobs.filter((job) => job.status === 'queued' || job.status === 'generating')

  return (
    <section className="panel ai-media-page mos-enter">
      <header className="ai-media-header">
        <div>
          <p className="eyebrow">AI Media</p>
          <h1>Generated media</h1>
          <p className="page-lede">
            Generation jobs for this Product. Reload-safe — in-progress work stays listed until it
            finishes or fails.
          </p>
        </div>
        <Link href="/studio" className="btn btn-primary">
          Open Studio
        </Link>
      </header>

      {inFlight.length > 0 ? (
        <p className="ai-media-banner" role="status" aria-live="polite">
          {inFlight.length === 1
            ? `1 job still running (${roleLabel(inFlight[0]!.role)}).`
            : `${inFlight.length} jobs still running.`}
        </p>
      ) : null}

      {loading ? (
        <p className="page-lede" role="status">
          Loading jobs…
        </p>
      ) : null}

      {!productId && !loading ? (
        <div className="ai-media-empty" role="alert">
          <h2 className="ai-media-empty-title">No active Product</h2>
          <p className="page-lede">Choose a Product to see generation jobs for it.</p>
          <Link href="/products" className="btn btn-primary">
            Open Products
          </Link>
        </div>
      ) : null}

      {productId && error ? (
        <div className="ai-media-empty" role="alert">
          <h2 className="ai-media-empty-title">Could not load jobs</h2>
          <p className="error">{error}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setLoading(true)
              void load(productId)
                .then(() => setError(null))
                .catch((err) => {
                  setError(
                    humanizeStudioError(err instanceof Error ? err.message : 'Failed to load'),
                  )
                })
                .finally(() => setLoading(false))
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {productId && !loading && !error && jobs.length === 0 ? (
        <div className="ai-media-empty" role="status">
          <h2 className="ai-media-empty-title">No generation jobs yet</h2>
          <p className="page-lede">
            Extract, music, or video jobs from Studio appear here. This page does not generate.
          </p>
          <Link href="/studio" className="btn btn-primary">
            Open Studio
          </Link>
        </div>
      ) : null}

      {!loading && !error && jobs.length > 0 ? (
        <ul className="ai-media-list">
          {jobs.map((job) => {
            const spend = formatGbp(job.actualGbp ?? job.estimatedGbp)
            const href = studioHrefForJob(job.projectId)
            const previewUrl =
              job.status === 'ready' && playableJobKind(job.outputKind)
                ? previewUrlForJob(job)
                : null
            return (
              <li key={job.id} className={`ai-media-item is-${job.status}`}>
                {previewUrl && job.outputKind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ai-media-preview" src={previewUrl} alt="" />
                ) : null}
                {previewUrl && job.outputKind === 'video' ? (
                  <video className="ai-media-preview" src={previewUrl} controls playsInline />
                ) : null}
                {previewUrl && job.outputKind === 'audio' ? (
                  <audio className="ai-media-preview-audio" src={previewUrl} controls />
                ) : null}
                <div className="ai-media-item-copy">
                  <Link href={href} className="ai-media-item-link">
                    {roleLabel(job.role)}
                  </Link>
                  <p className="ai-media-item-meta">
                    <span className={`ai-media-status is-${job.status}`}>
                      {statusLabel(job.status)}
                    </span>
                    {formatWhen(job.createdAt) ? <span>{formatWhen(job.createdAt)}</span> : null}
                    {spend ? <span>{spend}</span> : null}
                    {job.projectId ? (
                      <span>Project {job.projectId.slice(0, 8)}</span>
                    ) : (
                      <span>No project</span>
                    )}
                  </p>
                  {job.status === 'failed' && job.errorMessage ? (
                    <p className="error" role="alert">
                      {job.errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="ai-media-item-actions">
                  {jobCanPlace(job) ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={pendingPlaceId === job.id}
                      onClick={() => void placeJob(job)}
                    >
                      {pendingPlaceId === job.id ? 'Placing…' : 'Place in Studio'}
                    </button>
                  ) : null}
                  {job.status === 'failed' ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={pendingRetryId === job.id}
                      onClick={() => {
                        if (retryNeedsConfirm(job.estimatedGbp)) {
                          setConfirmRetry(job)
                          return
                        }
                        void retryJob(job, false)
                      }}
                    >
                      Retry
                    </button>
                  ) : (
                    <Link href={href} className="btn btn-ghost btn-sm">
                      {job.projectId ? 'Open in Studio' : 'Studio'}
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {actionError ? (
        <p className="error" role="alert">
          {actionError}
        </p>
      ) : null}

      {confirmRetry ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm retry spend"
        >
          <div className="dialog-panel">
            <p className="eyebrow">AI Media</p>
            <h3 className="dialog-title">Retry this job?</h3>
            <p className="muted">
              This retry is about {formatGbp(confirmRetry.estimatedGbp) ?? '£0.00'}. Same job, not a
              new prompt.
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmRetry(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const job = confirmRetry
                  setConfirmRetry(null)
                  void retryJob(job, true)
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {retryModalOpen ? (
        <div
          className="dialog-root"
          role="dialog"
          aria-modal="true"
          aria-label="Retrying generation"
        >
          <div className="dialog-panel">
            <p className="eyebrow">AI Media</p>
            <h3 className="dialog-title">Retrying…</h3>
            <p className="muted">This stays listed if you minimize or reload.</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRetryModalOpen(false)}
              >
                Minimize
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {productId ? <p className="ai-media-product muted">Product {productId}</p> : null}
    </section>
  )
}
