'use client'

import type { CreativeStructure } from '@synawood/creative/intent/creative-structure'
import type { StudioProject } from '@synawood/creative/project/client'
import { useState } from 'react'
import {
  STRUCTURE_EMPTY_META,
  STRUCTURE_FILL_BUTTON,
  STRUCTURE_FILL_DISABLED_HINT,
  STRUCTURE_FILL_ERROR,
  STRUCTURE_FILLING,
  structureBeatLabel,
  structureEmptyBody,
  structureFilledMeta,
  STRUCTURE_MANUAL_HINT,
} from '@/lib/studio-structure-copy'
import { formatBeatWindow, TIMELINE_FPS } from './timelineMath'

type CreativeStructurePanelProps = {
  projectId: string
  revision: number
  structure: CreativeStructure
  sceneCount: number
  fps?: number
  disabled?: boolean
  onProjectSaved: (project: StudioProject) => void
  onError: (message: string) => void
}

export const CreativeStructurePanel = ({
  projectId,
  revision,
  structure,
  sceneCount,
  fps = TIMELINE_FPS,
  disabled = false,
  onProjectSaved,
  onError,
}: CreativeStructurePanelProps) => {
  const [open, setOpen] = useState(structure.beats.length > 0 || sceneCount > 0)
  const [busy, setBusy] = useState<string | null>(null)

  const derive = () => {
    setBusy(STRUCTURE_FILLING)
    void (async () => {
      const response = await fetch(`/api/studio/projects/${projectId}/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, action: 'derive' }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        project?: StudioProject
      } | null
      if (!response.ok || !body?.project) {
        throw new Error(body?.error ?? STRUCTURE_FILL_ERROR)
      }
      onProjectSaved(body.project)
      setOpen(true)
    })()
      .catch((err) => onError(err instanceof Error ? err.message : STRUCTURE_FILL_ERROR))
      .finally(() => setBusy(null))
  }

  return (
    <section className="intent-rail" aria-label="Creative structure">
      <div className="intent-rail-toolbar">
        <button
          type="button"
          className={`intent-rail-tab${open ? ' is-active' : ''}`}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="intent-rail-tab-title">Structure</span>
          <span className="intent-rail-tab-meta">
            {structure.beats.length === 0
              ? STRUCTURE_EMPTY_META
              : structureFilledMeta(structure.beats.map((beat) => beat.kind))}
          </span>
        </button>
      </div>
      {busy ? (
        <div className="intent-change-banner" role="status">
          <p>{busy}</p>
        </div>
      ) : null}
      {open ? (
        <div className="intent-rail-body">
          {structure.beats.length === 0 ? (
            <p className="muted structure-empty-copy">{structureEmptyBody(sceneCount)}</p>
          ) : (
            <ol className="structure-beat-list">
              {structure.beats.map((beat, index) => (
                <li key={`${beat.kind}-${beat.sceneId ?? index}`}>
                  <strong>{structureBeatLabel(beat.kind)}</strong>
                  <span className="muted">
                    {formatBeatWindow(beat.from, beat.durationInFrames, fps)}
                    {structure.source === 'manual' ? ` · ${STRUCTURE_MANUAL_HINT}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={disabled || Boolean(busy) || sceneCount === 0}
            title={sceneCount === 0 ? STRUCTURE_FILL_DISABLED_HINT : undefined}
            onClick={derive}
          >
            {STRUCTURE_FILL_BUTTON}
          </button>
        </div>
      ) : null}
    </section>
  )
}
