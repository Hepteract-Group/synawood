'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { humanizeStudioError } from '@/lib/humanize-studio-error'
import {
  inFlightGenerationJobs,
  useProjectGenerationJobs,
  type GenerationJobSummary,
} from './useProjectGenerationJobs'

type Still = { assetId: string; url: string }

type ThumbnailPickerProps = {
  projectId: string
  revision?: number
  selectedId?: string | null
  candidateIds?: string[]
  stills?: Still[]
  jobs?: GenerationJobSummary[]
  disabled?: boolean
  compact?: boolean
  onChanged?: () => Promise<void> | void
}

type RemoteState = {
  selectedId: string | null
  candidateIds: string[]
  stills: Still[]
  revision: number
}

export const ThumbnailPicker = ({
  projectId,
  revision: revisionProp,
  selectedId: selectedProp,
  candidateIds: candidateProp,
  stills: stillsProp,
  jobs: jobsProp,
  disabled = false,
  compact = false,
  onChanged,
}: ThumbnailPickerProps) => {
  const { jobs: polledJobs } = useProjectGenerationJobs(projectId)
  const jobs = jobsProp ?? polledJobs
  const [remote, setRemote] = useState<RemoteState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [pending, setPending] = useState<'pick' | 'generate' | null>(null)

  const loadRemote = useCallback(async () => {
    const response = await fetch(
      `/api/studio/projects/${encodeURIComponent(projectId)}/thumbnail`,
      { credentials: 'same-origin' },
    )
    const body = (await response.json().catch(() => ({}))) as {
      error?: string
      thumbnailAssetId?: string | null
      candidates?: Still[]
      stills?: Still[]
      revision?: number
    }
    if (!response.ok) throw new Error(body.error ?? 'Could not load thumbnails.')
    setRemote({
      selectedId: body.thumbnailAssetId ?? null,
      candidateIds: (body.candidates ?? []).map((item) => item.assetId),
      stills: body.stills ?? [],
      revision: body.revision ?? 1,
    })
  }, [projectId])

  const selfFetch = !stillsProp
  useEffect(() => {
    if (!selfFetch) return
    void loadRemote().catch((caught) => {
      setError(humanizeStudioError(caught instanceof Error ? caught.message : 'Thumbnail failed.'))
    })
  }, [selfFetch, loadRemote])

  const inFlight = inFlightGenerationJobs(jobs).filter((job) => job.role === 'image')
  const generating = pending === 'generate' || inFlight.length > 0
  const queued = inFlight.some((job) => job.status === 'queued')

  useEffect(() => {
    if (generating && !minimized) setModalOpen(true)
  }, [generating, minimized])

  useEffect(() => {
    if (!selfFetch || !generating) return
    const timer = window.setInterval(() => {
      void loadRemote().catch(() => undefined)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [selfFetch, generating, loadRemote])

  const selectedId = selectedProp ?? remote?.selectedId ?? null
  const candidateIds = candidateProp ?? remote?.candidateIds ?? []
  const stills = stillsProp ?? remote?.stills ?? []
  const revision = revisionProp ?? remote?.revision ?? 1

  const options = useMemo(() => {
    const byId = new Map(stills.map((still) => [still.assetId, still]))
    const ordered = candidateIds
      .map((id) => byId.get(id))
      .filter((item): item is Still => Boolean(item))
    const extras = stills.filter((still) => !candidateIds.includes(still.assetId))
    return [...ordered, ...extras].slice(0, 8)
  }, [candidateIds, stills])

  const run = async (action: 'pick' | 'add' | 'generate', assetId?: string | null) => {
    if (action === 'pick' && (assetId ?? null) === selectedId) return
    setError(null)
    setPending(action === 'generate' ? 'generate' : 'pick')
    if (action === 'generate') {
      setModalOpen(true)
      setMinimized(false)
    }
    try {
      const response = await fetch(
        `/api/studio/projects/${encodeURIComponent(projectId)}/thumbnail`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: revision,
            action,
            assetId: assetId ?? null,
          }),
        },
      )
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not update thumbnail.')
      if (selfFetch) await loadRemote()
      await onChanged?.()
    } catch (caught) {
      setError(humanizeStudioError(caught instanceof Error ? caught.message : 'Thumbnail failed.'))
    } finally {
      setPending(null)
      if (action === 'generate') setModalOpen(false)
    }
  }

  return (
    <section
      className={`thumbnail-picker${compact ? ' is-compact' : ''}`}
      aria-label="Thumbnail"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="thumbnail-picker-head">
        <div>
          <p className="eyebrow">Thumbnail</p>
          {compact ? null : (
            <p className="muted thumbnail-picker-lede">
              Optional. YouTube will ask for one before Schedule. Approve does not need it.
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary thumbnail-picker-generate"
          disabled={disabled || pending !== null}
          onClick={() => {
            void run('generate')
          }}
        >
          Generate
        </button>
      </div>
      {generating ? (
        <div className="asset-bin-job-banner" role="status" aria-live="polite">
          {queued
            ? 'Making thumbnail options… If this stays queued, start the local worker.'
            : 'Making thumbnail options…'}
        </div>
      ) : null}
      {error ? (
        <p className="thumbnail-picker-error" role="alert">
          {error}
        </p>
      ) : null}
      {options.length === 0 ? (
        <p className="muted" role="status">
          Generate a still, or add one from Media.
        </p>
      ) : (
        <ul className="thumbnail-picker-grid">
          {options.map((still) => {
            const selected = still.assetId === selectedId
            return (
              <li key={still.assetId}>
                <button
                  type="button"
                  className={`thumbnail-picker-still${selected ? ' is-selected' : ''}`}
                  disabled={disabled || pending !== null}
                  aria-pressed={selected}
                  aria-label={selected ? 'Selected thumbnail' : 'Use this still'}
                  onClick={() => {
                    void run('pick', still.assetId)
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={still.url} alt="" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {modalOpen && !minimized ? (
        <div className="dialog-root" role="dialog" aria-modal="true" aria-label="Making thumbnails">
          <div className="dialog-panel">
            <p className="eyebrow">Thumbnail</p>
            <h3 className="dialog-title">Making thumbnail options…</h3>
            <p className="muted">This stays on the cut if you minimize or reload.</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setMinimized(true)}>
                Minimize
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
