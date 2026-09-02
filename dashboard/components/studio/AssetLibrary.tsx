'use client'

import type { StudioProject } from '@synawood/creative/project/client'
import { assetLabel, assetTokenFor } from '@synawood/creative/project/asset-token'
import { voiceProvenanceBadgeLabel } from '@synawood/creative/voice/schema'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconMoreVertical, IconTrash } from '../icons'
import { AudioPreviewPlayer } from './AudioPreviewPlayer'
import { AudioTilePreview } from './AudioTilePreview'
import { ConfirmDialog } from './ConfirmDialog'
import type { PlaceAssetOptions } from './story-preview-helpers'

export type GalleryAsset = StudioProject['assets'][number] & { signedUrl?: string }

type AssetLibraryProps = {
  projectId: string
  assets: GalleryAsset[]
  revision: number
  disabled?: boolean
  dragDisabled?: boolean
  placementDisabled?: boolean
  onRemoved: () => void
  onRemoveAsset: (assetId: string) => Promise<void>
  onRenameAsset?: (assetId: string, name: string) => Promise<void>
  onPlaceAsset?: (assetId: string, options?: PlaceAssetOptions) => Promise<void>
  onReferenceAsset?: (token: string) => void
  /** Inserts a grounded “transcribe @asset:…” chat draft for audio/video. */
  onTranscribeAsset?: (prompt: string) => void
}

const labelOf = (asset: GalleryAsset): string => assetLabel(asset).slice(0, 40)

const tokenFor = (asset: GalleryAsset): string => assetTokenFor(asset)

export const assetContentUrl = (projectId: string, assetId: string): string =>
  `/api/studio/projects/${projectId}/assets/${assetId}/content`

/** Fast JPEG cover written at upload (`probe.posterBlobKey`). */
export const assetPosterUrl = (
  projectId: string,
  asset: Pick<GalleryAsset, 'id' | 'probe'>,
): string | null => {
  const key = asset.probe?.posterBlobKey
  if (typeof key !== 'string' || !key) return null
  return `${assetContentUrl(projectId, asset.id)}?variant=poster`
}

const sourceLabel = (asset: GalleryAsset): string => {
  if (asset.source === 'url') return 'from URL'
  if (asset.source === 'generator') {
    const modelId = String(asset.probe?.modelId ?? 'mock')
    if (modelId === 'mock' || modelId.startsWith('placeholder/') || modelId.includes('mock')) {
      return 'Mock · generator'
    }
    return 'generator'
  }
  return asset.source.replace('_', ' ')
}

const AssetThumb = ({
  kind,
  src,
  posterSrc,
  alt,
  className,
  controls,
}: {
  kind: GalleryAsset['kind']
  src: string | undefined
  /** Prefer small JPEG over loading the full video for grid tiles. */
  posterSrc?: string | null
  alt: string
  className?: string
  controls?: boolean
}) => {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [src, posterSrc])

  if ((!src && !posterSrc) || failed) {
    return (
      <span className={className ?? 'asset-tile-glyph'} role="img" aria-label={alt}>
        {failed ? 'Preview unavailable' : kind}
      </span>
    )
  }

  if (kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} onError={() => setFailed(true)} />
    )
  }
  if (kind === 'video') {
    if (posterSrc && !controls) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterSrc} alt={alt} onError={() => setFailed(true)} />
      )
    }
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={src ? `${src}#t=0.1` : undefined}
        poster={posterSrc ?? undefined}
        muted={!controls}
        playsInline
        controls={controls}
        autoPlay={controls}
        preload="metadata"
        onError={() => setFailed(true)}
      />
    )
  }
  if (kind === 'audio') {
    if (!src) {
      return (
        <span className={className ?? 'asset-tile-glyph'} role="img" aria-label={alt}>
          {kind}
        </span>
      )
    }
    return <AudioPreviewPlayer src={src} label={alt} />
  }
  return (
    <span className={className ?? 'asset-tile-glyph'} role="img" aria-label={alt}>
      {kind}
    </span>
  )
}

const MENU_WIDTH = 168
const MENU_GAP = 4

const AssetActionsMenu = ({
  asset,
  disabled,
  placementDisabled,
  placing,
  onPlace,
  onTranscribe,
  onReference,
}: {
  asset: GalleryAsset
  disabled: boolean
  placementDisabled: boolean
  placing: boolean
  onPlace?: () => void
  onTranscribe?: () => void
  onReference?: () => void
}) => {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    openAbove: boolean
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const menuId = useId()

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null)
      return
    }
    const rect = triggerRef.current.getBoundingClientRect()
    const estimatedMenuHeight = 140
    const spaceRight = window.innerWidth - rect.left
    const spaceBelow = window.innerHeight - rect.bottom
    const openAbove = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow
    const left = Math.min(
      Math.max(8, spaceRight >= MENU_WIDTH + 8 ? rect.left : rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    )
    setCoords({
      top: openAbove ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
      left,
      openAbove,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onReposition = () => setOpen(false)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  const items: Array<{ id: string; label: string; disabled?: boolean; run: () => void }> = []
  if ((asset.kind === 'video' || asset.kind === 'audio') && onPlace) {
    items.push({
      id: 'place',
      label: placing ? 'Placing…' : 'Add to timeline',
      disabled: placementDisabled || placing,
      run: onPlace,
    })
  }
  if ((asset.kind === 'audio' || asset.kind === 'video') && onTranscribe) {
    items.push({
      id: 'transcribe',
      label: 'Transcribe in chat',
      run: onTranscribe,
    })
  }
  if (onReference) {
    items.push({
      id: 'chat',
      label: 'Mention in chat',
      run: onReference,
    })
  }
  if (items.length === 0) return null

  const menu =
    open && coords
      ? createPortal(
          <ul
            id={menuId}
            ref={menuRef}
            className="asset-tile-menu-list asset-tile-menu-list-portal"
            role="menu"
            style={{
              top: coords.top,
              left: coords.left,
              width: MENU_WIDTH,
              transform: coords.openAbove ? 'translateY(-100%)' : undefined,
            }}
          >
            {items.map((item) => (
              <li key={item.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="asset-tile-menu-item"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.run()
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null

  return (
    <div className="asset-tile-menu">
      <button
        type="button"
        ref={triggerRef}
        className="asset-tile-menu-trigger"
        aria-label="Asset actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <IconMoreVertical width={14} height={14} />
      </button>
      {menu}
    </div>
  )
}

export const AssetLibrary = ({
  projectId,
  assets,
  revision,
  disabled = false,
  dragDisabled = disabled,
  placementDisabled = disabled,
  onRemoved,
  onRemoveAsset,
  onRenameAsset,
  onPlaceAsset,
  onReferenceAsset,
  onTranscribeAsset,
}: AssetLibraryProps) => {
  void revision
  void onRemoved
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [placingId, setPlacingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [preview, setPreview] = useState<GalleryAsset | null>(null)
  const [confirming, setConfirming] = useState<GalleryAsset | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onConfirmRemove = async () => {
    const asset = confirming
    if (!asset) return
    setConfirming(null)
    setRemovingId(asset.id)
    setError(null)
    try {
      await onRemoveAsset(asset.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setRemovingId(null)
    }
  }

  const onPlace = async (asset: GalleryAsset) => {
    if (!onPlaceAsset) return
    setPlacingId(asset.id)
    setError(null)
    try {
      await onPlaceAsset(asset.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Place failed')
    } finally {
      setPlacingId(null)
    }
  }

  const commitRename = async (asset: GalleryAsset) => {
    if (!onRenameAsset) {
      setRenamingId(null)
      return
    }
    const next = renameDraft.trim()
    if (!next || next === labelOf(asset)) {
      setRenamingId(null)
      return
    }
    setError(null)
    try {
      await onRenameAsset(asset.id, next)
      setRenamingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed')
    }
  }

  if (assets.length === 0) {
    return (
      <div className="asset-library asset-library-empty">
        <p className="muted">No assets yet. Upload footage or generate media to see it here.</p>
      </div>
    )
  }

  return (
    <div className="asset-library">
      {error ? <p className="error">{error}</p> : null}
      <div className="asset-library-grid">
        {assets.map((asset) => {
          const contentUrl = assetContentUrl(projectId, asset.id)
          const posterUrl = assetPosterUrl(projectId, asset)
          return (
            <figure
              key={asset.id}
              className="asset-tile"
              draggable={!dragDisabled}
              onDragStart={(event) => {
                if (dragDisabled) {
                  event.preventDefault()
                  return
                }
                event.dataTransfer.effectAllowed = 'copy'
                event.dataTransfer.setData('application/x-mos-asset-id', asset.id)
                event.dataTransfer.setData('text/plain', asset.id)
              }}
            >
              {asset.kind === 'audio' ? (
                <div className="asset-tile-preview">
                  <AudioTilePreview src={contentUrl} seed={asset.id} label={labelOf(asset)} />
                </div>
              ) : (
                <button
                  type="button"
                  className="asset-tile-preview"
                  onClick={() => setPreview(asset)}
                  title="Preview"
                >
                  <AssetThumb
                    kind={asset.kind}
                    src={contentUrl}
                    posterSrc={posterUrl}
                    alt={labelOf(asset)}
                  />
                </button>
              )}
              <div className="asset-tile-footer">
                <figcaption className="asset-tile-meta">
                  {renamingId === asset.id ? (
                    <input
                      className="asset-tile-rename"
                      value={renameDraft}
                      autoFocus
                      maxLength={80}
                      aria-label="Rename asset"
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onBlur={() => void commitRename(asset)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void commitRename(asset)
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setRenamingId(null)
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="asset-tile-label"
                      title={`${labelOf(asset)} — click to rename`}
                      disabled={disabled || !onRenameAsset}
                      onClick={() => {
                        setRenamingId(asset.id)
                        setRenameDraft(assetLabel(asset))
                      }}
                    >
                      {labelOf(asset)}
                    </button>
                  )}
                  <span className="asset-tile-source muted" title={sourceLabel(asset)}>
                    {sourceLabel(asset)}
                    {voiceProvenanceBadgeLabel(asset.probe)
                      ? ` · ${voiceProvenanceBadgeLabel(asset.probe)}`
                      : ''}
                  </span>
                </figcaption>
                <div className="asset-tile-footer-actions">
                  <AssetActionsMenu
                    asset={asset}
                    disabled={disabled}
                    placementDisabled={placementDisabled}
                    placing={placingId === asset.id}
                    onPlace={onPlaceAsset ? () => void onPlace(asset) : undefined}
                    onTranscribe={
                      onTranscribeAsset
                        ? () => onTranscribeAsset(`transcribe ${tokenFor(asset)}`)
                        : undefined
                    }
                    onReference={
                      onReferenceAsset ? () => onReferenceAsset(tokenFor(asset)) : undefined
                    }
                  />
                  <button
                    type="button"
                    className="asset-tile-remove"
                    title="Remove asset"
                    aria-label="Remove asset"
                    disabled={disabled || removingId === asset.id}
                    onClick={() => setConfirming(asset)}
                  >
                    {removingId === asset.id ? '…' : <IconTrash width={14} height={14} />}
                  </button>
                </div>
              </div>
            </figure>
          )
        })}
      </div>
      <ConfirmDialog
        open={confirming !== null}
        title={confirming?.kind === 'video' ? 'Remove this video?' : 'Remove this asset?'}
        body={
          confirming
            ? `“${labelOf(confirming)}” will be removed from the project. Any clips using it will be dropped.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => void onConfirmRemove()}
        onCancel={() => setConfirming(null)}
      />
      {preview ? (
        <div className="asset-lightbox" role="dialog" aria-modal="true">
          <button
            type="button"
            className="asset-lightbox-backdrop"
            onClick={() => setPreview(null)}
            aria-label="Close preview"
          />
          <div className="asset-lightbox-panel">
            <div className="asset-lightbox-media">
              <AssetThumb
                kind={preview.kind}
                src={assetContentUrl(projectId, preview.id)}
                posterSrc={assetPosterUrl(projectId, preview)}
                alt={labelOf(preview)}
                className="asset-lightbox-fallback"
                controls
              />
            </div>
            <div className="asset-lightbox-meta">
              <strong>{labelOf(preview)}</strong>
              <span className="muted">
                {preview.kind} · {sourceLabel(preview)}
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
