'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { listTreatments, type TreatmentId } from '@synawood/creative/effects/treatments'
import type { LibraryItem, LibraryKind } from '@synawood/creative/library'
import type { ClipTreatment } from '@synawood/creative/project/schema'
import {
  failedGenerationJobs,
  formatGenerationJobLine,
  inFlightGenerationJobs,
  useProjectGenerationJobs,
} from './useProjectGenerationJobs'

type LibraryAuthoringProps = {
  projectId: string
  kind: Extract<LibraryKind, 'sticker' | 'filter' | 'effect'>
  disabled?: boolean
  confirmSpend?: boolean
  clipTreatments?: ClipTreatment[]
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })

export const LibraryAuthoring = ({
  projectId,
  kind,
  disabled = false,
  confirmSpend = false,
  clipTreatments = [],
}: LibraryAuthoringProps) => {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<'generate' | 'filter' | 'effect' | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [label, setLabel] = useState('New item')
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState<TreatmentId[]>([])
  const fileRef = useRef<HTMLInputElement | null>(null)
  const { jobs, reload } = useProjectGenerationJobs(projectId)
  const libraryJobs = jobs.filter(
    (job) => job.libraryKind === kind || job.libraryKind === 'sticker',
  )
  const inFlight = inFlightGenerationJobs(libraryJobs)

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/studio/projects/${encodeURIComponent(projectId)}/library?kind=${kind}`,
      { credentials: 'same-origin' },
    )
    const body = (await response.json().catch(() => ({}))) as {
      items?: LibraryItem[]
      error?: string
    }
    if (!response.ok) {
      setError(body.error ?? 'Could not load library.')
      return
    }
    setItems((body.items ?? []).filter((item) => item.source !== 'first-party'))
  }, [kind, projectId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (inFlight.length === 0) void load()
  }, [inFlight.length, load])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      await load()
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Library action failed.')
    } finally {
      setBusy(false)
    }
  }

  const createFilter = () =>
    run(async () => {
      const response = await fetch(
        `/api/studio/projects/${encodeURIComponent(projectId)}/library`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'filter',
            label,
            createdBy: 'user',
            recipe: { contrast: 1.1, saturate: 1.05, hueRotate: 4, sepia: 0.08, vignette: 0.15 },
          }),
        },
      )
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not save look.')
      setModal(null)
    })

  const createEffect = () =>
    run(async () => {
      const fromPicker = selectedTreatmentIds.map((id) => {
        const onClip = clipTreatments.find((step) => step.id === id)
        return { id, intensity: onClip?.intensity ?? 1 }
      })
      const steps =
        fromPicker.length > 0
          ? fromPicker
          : clipTreatments.map((step) => ({ id: step.id, intensity: step.intensity }))
      if (steps.length === 0) {
        throw new Error('Pick shake, glow, flash, or zoom punch, then save.')
      }
      const response = await fetch(
        `/api/studio/projects/${encodeURIComponent(projectId)}/library`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'effect',
            label,
            createdBy: 'user',
            recipe: { steps },
          }),
        },
      )
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not save stack.')
      setModal(null)
    })

  const generateSticker = () =>
    run(async () => {
      const response = await fetch(
        `/api/studio/projects/${encodeURIComponent(projectId)}/library`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'sticker',
            label,
            prompt,
            confirmSpend,
            createdBy: 'user',
          }),
        },
      )
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not generate sticker.')
      setModal(null)
    })

  const importFile = (file: File) =>
    run(async () => {
      const bytesBase64 = await fileToBase64(file)
      const jsonText = file.name.toLowerCase().endsWith('.json') ? await file.text() : undefined
      const response = await fetch(
        `/api/studio/projects/${encodeURIComponent(projectId)}/library/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            jsonText,
            bytesBase64: jsonText ? undefined : bytesBase64,
            label: file.name.replace(/\.[^.]+$/, ''),
            kind,
          }),
        },
      )
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not import file.')
    })

  const clearLicense = (itemId: string) =>
    run(async () => {
      const response = await fetch(
        `/api/studio/projects/${encodeURIComponent(projectId)}/library/${encodeURIComponent(itemId)}/license`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commercialUseAllowed: true }),
        },
      )
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not clear license.')
    })

  return (
    <div className="library-authoring">
      <div className="library-authoring-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={disabled || busy}
          onClick={() => {
            if (kind === 'sticker') {
              setModal('generate')
              setMinimized(false)
              return
            }
            if (kind === 'filter') {
              setModal('filter')
              return
            }
            setSelectedTreatmentIds(clipTreatments.map((step) => step.id as TreatmentId))
            setModal('effect')
            setMinimized(false)
          }}
        >
          {kind === 'sticker' ? 'Generate…' : 'New…'}
        </button>
        {kind === 'sticker' ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={disabled || busy}
            onClick={() => {
              setModal('generate')
              setMinimized(false)
            }}
          >
            New…
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled>
            Generate…
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
        >
          Import…
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={
            kind === 'sticker' ? 'image/png,image/webp,image/svg+xml' : 'application/json,.json'
          }
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void importFile(file)
          }}
        />
      </div>
      {inFlight.length > 0 || busy ? (
        <div className="asset-bin-job-banner" role="status" aria-live="polite">
          {inFlight.length > 0
            ? inFlight.map((job) => formatGenerationJobLine(job)).join(' ')
            : 'Saving library item…'}
        </div>
      ) : null}
      {failedGenerationJobs(libraryJobs).map((job) => (
        <p key={job.id} className="asset-bin-empty-hint" role="alert">
          {formatGenerationJobLine(job)}
        </p>
      ))}
      {error ? (
        <p className="asset-bin-empty-hint" role="alert">
          {error}
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul className="effects-pack-list">
          {items.map((item) => (
            <li key={item.id}>
              <span>
                {item.label}
                {item.commercialUseAllowed ? '' : ' · license unknown'}
              </span>
              {item.commercialUseAllowed ? null : (
                <label>
                  <input
                    type="checkbox"
                    disabled={disabled || busy}
                    onChange={() => void clearLicense(item.id)}
                  />{' '}
                  I have the right to use this commercially
                </label>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {modal && !minimized ? (
        <div className="dialog-root" role="dialog" aria-modal="true" aria-label="Library item">
          <button
            type="button"
            className="dialog-backdrop"
            aria-label="Minimize"
            onClick={() => setMinimized(true)}
          />
          <div className="dialog-panel">
            <p className="eyebrow">Library</p>
            <h3 className="dialog-title">
              {kind === 'sticker'
                ? 'Generate sticker'
                : kind === 'effect'
                  ? 'Save effect'
                  : 'Save look'}
            </h3>
            <label>
              Name
              <input value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>
            {modal === 'generate' ? (
              <label>
                Prompt
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              </label>
            ) : null}
            {modal === 'effect' ? (
              <fieldset className="library-authoring-treatments">
                <legend>Treatments</legend>
                {listTreatments().map((item) => {
                  const checked = selectedTreatmentIds.includes(item.id)
                  return (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedTreatmentIds((current) =>
                            checked
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          )
                        }}
                      />{' '}
                      {item.label}
                    </label>
                  )
                })}
              </fieldset>
            ) : null}
            <p className="muted">
              Minimize keeps a banner in this tab. Reload still polls the job.
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setMinimized(true)}>
                Minimize
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={disabled || busy}
                onClick={() => {
                  if (modal === 'generate') void generateSticker()
                  else if (modal === 'effect') void createEffect()
                  else void createFilter()
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
