'use client'

import { useId, useState } from 'react'

type AddFromUrlDialogProps = {
  open: boolean
  pending?: boolean
  onClose: () => void
  onSubmit: (url: string) => Promise<void>
}

/** Media bin — paste an image URL; bytes stored in Blob (#108). */
export const AddFromUrlDialog = ({ open, pending, onClose, onSubmit }: AddFromUrlDialogProps) => {
  const fieldId = useId()
  const titleId = useId()
  const [url, setUrl] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const submit = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setLocalError('Paste an image URL first.')
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await onSubmit(trimmed)
      setUrl('')
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not add that URL.')
    } finally {
      setBusy(false)
    }
  }

  const disabled = Boolean(pending) || busy

  return (
    <div className="dialog-root" role="presentation">
      <button type="button" className="dialog-backdrop" onClick={onClose} aria-label="Close" />
      <div
        className="dialog-panel add-from-url-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="dialog-title">
          Add from URL
        </h2>
        <p className="muted add-from-url-lede">
          Paste a direct link to a JPEG, PNG, WebP, or GIF. We copy the file into your library so
          renders never depend on the remote host.
        </p>
        <label className="add-from-url-field" htmlFor={fieldId}>
          <span className="visually-hidden">Image URL</span>
          <input
            id={fieldId}
            type="url"
            value={url}
            disabled={disabled}
            placeholder="https://…"
            autoComplete="off"
            onChange={(event) => {
              setUrl(event.target.value)
              if (localError) setLocalError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void submit()
              }
            }}
          />
        </label>
        {localError ? (
          <p className="add-from-url-error" role="alert">
            {localError}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={disabled}
            onClick={() => void submit()}
          >
            {busy ? 'Adding…' : 'Add to library'}
          </button>
        </div>
      </div>
    </div>
  )
}
