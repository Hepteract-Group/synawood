'use client'

import type { StudioProject } from '@synawood/creative/project/schema'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

type PromoteField = 'hook' | 'end_card'

const PROMOTE_FIELD_LABELS: Record<PromoteField, string> = {
  hook: 'Opening line',
  end_card: 'Call to action',
}

const PROMOTE_FIELD_OPTIONS = Object.keys(PROMOTE_FIELD_LABELS) as PromoteField[]

type VariantChildEditorProps = {
  project: StudioProject
  parentProjectId: string
  open: boolean
  onClose: () => void
  onChanged: () => void
}

const overlayText = (project: StudioProject, kind: 'hook_title' | 'end_card'): string =>
  project.overlays.find((overlay) => overlay.kind === kind)?.text ?? ''

export const VariantChildEditor = ({
  project,
  parentProjectId,
  open,
  onClose,
  onChanged,
}: VariantChildEditorProps) => {
  const [hookText, setHookText] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [promoteFields, setPromoteFields] = useState<PromoteField[]>(['hook', 'end_card'])
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoteBusy, setPromoteBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setHookText(overlayText(project, 'hook_title'))
    setCtaText(overlayText(project, 'end_card'))
    setError(null)
    setStatus(null)
  }, [open, project.id, project.revision, project.overlays])

  if (!open) return null

  const saveOverrides = async () => {
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const response = await fetch(
        `/api/studio/projects/${parentProjectId}/variants/${project.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hookText,
            ctaText,
            expectedRevision: project.revision,
          }),
        },
      )
      const body = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not save changes')
      setStatus('Saved on this ad version.')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  const runPromote = async () => {
    if (promoteFields.length === 0) return
    setPromoteBusy(true)
    setError(null)
    setStatus(null)
    try {
      const parentResponse = await fetch(`/api/studio/projects/${parentProjectId}`)
      const parentBody = (await parentResponse.json()) as {
        project?: { revision: number }
        error?: string
      }
      if (!parentResponse.ok || !parentBody.project) {
        throw new Error(parentBody.error ?? 'Could not load main cut')
      }

      const response = await fetch(
        `/api/studio/projects/${parentProjectId}/variants/${project.id}/promote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: promoteFields,
            expectedRevision: parentBody.project.revision,
          }),
        },
      )
      const body = (await response.json()) as {
        applied?: PromoteField[]
        skipped?: PromoteField[]
        error?: string
      }
      if (!response.ok) throw new Error(body.error ?? 'Could not promote to main cut')
      const applied = body.applied ?? []
      const skipped = body.skipped ?? []
      setStatus(
        `Updated main cut: ${applied.map((field) => PROMOTE_FIELD_LABELS[field]).join(', ')}${
          skipped.length
            ? ` · skipped ${skipped.map((field) => PROMOTE_FIELD_LABELS[field]).join(', ')}`
            : ''
        }`,
      )
      setPromoteOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not promote to main cut')
    } finally {
      setPromoteBusy(false)
    }
  }

  return (
    <>
      <div
        className="dialog-root brand-studio-root variant-child-editor-root"
        role="dialog"
        aria-modal="true"
        aria-label="Edit this ad version"
      >
        <button type="button" className="dialog-backdrop" onClick={onClose} aria-label="Close" />
        <div className="dialog-panel brand-studio-panel variant-child-editor-panel">
          <header className="brand-studio-header">
            <div>
              <p className="eyebrow">Ad version</p>
              <h2>Edit this version</h2>
              <p className="muted ad-generator-lede">
                Change the opening line or CTA on this cut, then optionally copy fields back to the
                main project.
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </header>

          <div className="variant-child-editor-body">
            <label className="variant-override-field">
              <span>Opening line</span>
              <textarea
                rows={3}
                value={hookText}
                onChange={(event) => setHookText(event.target.value)}
              />
            </label>
            <label className="variant-override-field">
              <span>Call to action</span>
              <textarea
                rows={2}
                value={ctaText}
                onChange={(event) => setCtaText(event.target.value)}
              />
            </label>
            <div className="variant-override-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !hookText.trim() || !ctaText.trim()}
                onClick={() => void saveOverrides()}
              >
                {saving ? 'Saving…' : 'Save on this version'}
              </button>
              <a className="btn btn-ghost" href={`/studio/${parentProjectId}`}>
                Back to main cut
              </a>
            </div>

            <div className="variant-promote-block">
              <h4>Promote to main cut</h4>
              <p className="muted">
                Copy the fields you edited above onto the main project. Nothing else changes.
              </p>
              <div className="variant-promote-fields" role="group" aria-label="Fields to promote">
                {PROMOTE_FIELD_OPTIONS.map((field) => (
                  <label key={field} className="variant-promote-field">
                    <input
                      type="checkbox"
                      checked={promoteFields.includes(field)}
                      onChange={() =>
                        setPromoteFields((prev) =>
                          prev.includes(field)
                            ? prev.filter((item) => item !== field)
                            : [...prev, field],
                        )
                      }
                    />
                    <span>{PROMOTE_FIELD_LABELS[field]}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={promoteBusy || promoteFields.length === 0}
                onClick={() => setPromoteOpen(true)}
              >
                Promote to main cut…
              </button>
            </div>

            {status ? (
              <p className="variant-promote-status" role="status">
                {status}
              </p>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={promoteOpen}
        title="Promote to main cut?"
        body={`This updates your main project with: ${promoteFields
          .map((field) => PROMOTE_FIELD_LABELS[field])
          .join(', ')}. Other fields on the main cut stay as they are.`}
        confirmLabel={promoteBusy ? 'Promoting…' : 'Promote'}
        cancelLabel="Cancel"
        danger={false}
        onConfirm={() => void runPromote()}
        onCancel={() => setPromoteOpen(false)}
      />
    </>
  )
}
