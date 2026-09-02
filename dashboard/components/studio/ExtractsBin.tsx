'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { IconTrash } from '../icons'
import { ConfirmDialog } from './ConfirmDialog'

type ExtractQuality = 'usable' | 'weak' | 'reject'
type ExtractKind = 'screenshot' | 'still' | 'text'

type ExtractItem = {
  id: string
  kind: ExtractKind
  sourceUrl: string
  text: string | null
  quality: ExtractQuality
  qualityNote: string | null
  createdAt: string
  thumbUrl: string | null
}

type ExtractsBinProps = {
  productId: string
  placementDisabled?: boolean
  onPlaceExtract: (extractId: string) => Promise<void>
}

const POLL_INTERVAL_MS = 12_000

const sourceLabel = (url: string): string => {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/$/, '') || ''
    return parsed.hostname + (path.length > 0 && path !== '/' ? path : '')
  } catch {
    return url
  }
}

const QUALITY_LABEL: Record<ExtractQuality, string> = {
  usable: 'usable',
  weak: 'weak',
  reject: 'reject',
}

export const ExtractsBin = ({
  productId,
  placementDisabled = false,
  onPlaceExtract,
}: ExtractsBinProps) => {
  const [extracts, setExtracts] = useState<ExtractItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ExtractItem | null>(null)
  const [confirmItem, setConfirmItem] = useState<ExtractItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/extracts`)
      const body = (await res.json().catch(() => ({}))) as {
        extracts?: ExtractItem[]
        error?: string
      }
      if (cancelledRef.current) return
      if (!res.ok) {
        setError(body.error ?? `Failed to load extracts (${res.status})`)
        return
      }
      setExtracts(body.extracts ?? [])
      setError(null)
    } catch (err) {
      if (cancelledRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load extracts')
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    cancelledRef.current = false
    setLoading(true)
    void load()
    const timer = setInterval(() => {
      void load()
    }, POLL_INTERVAL_MS)
    return () => {
      cancelledRef.current = true
      clearInterval(timer)
    }
  }, [load])

  useEffect(() => {
    if (!selected) return
    const latest = extracts.find((item) => item.id === selected.id)
    if (latest && latest !== selected) setSelected(latest)
  }, [extracts, selected])

  const deleteExtract = async (item: ExtractItem) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/products/${productId}/extracts/${item.id}`, {
        method: 'DELETE',
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to delete extract (${res.status})`)
      }
      setExtracts((prev) => prev.filter((row) => row.id !== item.id))
      if (selected?.id === item.id) setSelected(null)
      setConfirmItem(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
      setConfirmItem(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="extract-bin">
        <ul className="extract-bin-grid" aria-busy="true" aria-label="Loading extracts">
          {[0, 1, 2, 3].map((slot) => (
            <li key={slot} className="extract-card is-skeleton" aria-hidden />
          ))}
        </ul>
      </div>
    )
  }

  if (error) {
    return (
      <div className="extract-bin">
        <p className="extract-bin-error" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (extracts.length === 0) {
    return (
      <div className="extract-bin">
        <div className="extract-bin-empty">
          <p className="muted">Paste a public product URL to capture pages.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="extract-bin">
      {deleteError ? (
        <p className="extract-bin-error" role="alert">
          {deleteError}
        </p>
      ) : null}
      <ul className="extract-bin-grid" aria-label="Product extracts">
        {extracts.map((item) => (
          <li key={item.id} className="extract-card-item">
            <button
              type="button"
              className={item.quality === 'reject' ? 'extract-card is-reject' : 'extract-card'}
              onClick={() => setSelected(item)}
            >
              <div className="extract-card-thumb" aria-hidden>
                {item.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbUrl} alt="" />
                ) : item.kind === 'text' ? (
                  <span className="extract-card-text-glyph">T</span>
                ) : (
                  <span className="extract-card-text-glyph">⬜</span>
                )}
                <span
                  className={`extract-card-quality is-${item.quality}`}
                  title={item.qualityNote ?? item.quality}
                  aria-label={`Quality: ${QUALITY_LABEL[item.quality]}`}
                >
                  {QUALITY_LABEL[item.quality]}
                </span>
              </div>
              <div className="extract-card-foot">
                <p className="extract-card-url" title={item.sourceUrl}>
                  {sourceLabel(item.sourceUrl)}
                </p>
                {item.kind === 'text' && item.text ? (
                  <p className="extract-card-snippet">{item.text.slice(0, 80)}</p>
                ) : null}
              </div>
            </button>
            <button
              type="button"
              className="extract-card-delete"
              aria-label={`Delete extract from ${sourceLabel(item.sourceUrl)}`}
              title="Delete extract"
              disabled={deleting}
              onClick={() => setConfirmItem(item)}
            >
              <IconTrash width={14} height={14} />
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <ExtractInspector
          key={selected.id}
          item={selected}
          placementDisabled={placementDisabled}
          onClose={() => setSelected(null)}
          onPlace={onPlaceExtract}
          onDelete={() => setConfirmItem(selected)}
          confirmOpen={confirmItem?.id === selected.id}
        />
      ) : null}
      <ConfirmDialog
        open={confirmItem !== null}
        title="Delete this extract?"
        body={`Removes this extract from ${productId} for every Studio project. You cannot undo this.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmItem) void deleteExtract(confirmItem)
        }}
        onCancel={() => setConfirmItem(null)}
      />
    </div>
  )
}

const ExtractInspector = ({
  item,
  placementDisabled,
  onClose,
  onPlace,
  onDelete,
  confirmOpen,
}: {
  item: ExtractItem
  placementDisabled: boolean
  onClose: () => void
  onPlace: (extractId: string) => Promise<void>
  onDelete: () => void
  confirmOpen: boolean
}) => {
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const canPlace = item.kind !== 'text'

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !confirmOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, confirmOpen, onClose])

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.sourceUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="asset-lightbox" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="asset-lightbox-backdrop"
        onClick={busy ? undefined : onClose}
        aria-label="Close preview"
      />
      <div className="asset-lightbox-panel extract-inspector-panel">
        <div className="asset-lightbox-media">
          {item.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbUrl} alt="" />
          ) : (
            <p className="muted asset-lightbox-fallback">
              {item.kind === 'text' ? item.text : 'No still stored'}
            </p>
          )}
        </div>
        <div className="asset-lightbox-meta">
          <h2 id={titleId}>Extract</h2>
          <dl className="extract-inspector-meta">
            <div>
              <dt>Source URL</dt>
              <dd>
                <span className="extract-inspector-url">{item.sourceUrl}</span>
                <button
                  type="button"
                  className="btn btn-ghost extract-inspector-copy"
                  onClick={() => void copyUrl()}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd>
                <span className={`extract-card-quality is-${item.quality}`}>
                  {QUALITY_LABEL[item.quality]}
                </span>
              </dd>
            </div>
            <div>
              <dt>Quality note</dt>
              <dd>{item.qualityNote ?? '—'}</dd>
            </div>
          </dl>
          {placeError ? (
            <p className="extract-bin-error" role="alert">
              {placeError}
            </p>
          ) : null}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDelete}>
              Delete
            </button>
            {canPlace ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={placementDisabled || busy}
                title={placementDisabled ? 'Wait until the current edit finishes' : undefined}
                onClick={() => {
                  setBusy(true)
                  setPlaceError(null)
                  void onPlace(item.id)
                    .then(() => onClose())
                    .catch((err) => {
                      setPlaceError(err instanceof Error ? err.message : 'Place failed')
                    })
                    .finally(() => setBusy(false))
                }}
              >
                {busy ? 'Placing…' : 'Place on cut'}
              </button>
            ) : (
              <p className="muted">
                Text extracts stay in the bin — they cannot be placed as stills.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
