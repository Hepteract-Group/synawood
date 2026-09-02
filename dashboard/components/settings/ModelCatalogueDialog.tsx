'use client'

import { useEffect } from 'react'
import { ModelCatalogueContent } from './ModelCatalogueContent'

type ModelCatalogueDialogProps = {
  open: boolean
  highlightId?: string | null
  onClose: () => void
}

export const ModelCatalogueDialog = ({ open, highlightId, onClose }: ModelCatalogueDialogProps) => {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="dialog-root" role="dialog" aria-modal="true" aria-label="Models">
      <button type="button" className="dialog-backdrop" onClick={onClose} aria-label="Close" />
      <div className="dialog-panel model-catalogue-dialog">
        <header className="model-catalogue-dialog-header">
          <h2 className="dialog-title">Models</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        <ModelCatalogueContent highlightId={highlightId} />
      </div>
    </div>
  )
}
