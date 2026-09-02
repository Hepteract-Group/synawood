'use client'

/**
 * Story Builder asset preview + shot navigator (#172).
 * Operate: reuse Studio dialog/lightbox tokens; no new visual world.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { assetContentUrl, assetPosterUrl, type GalleryAsset } from './AssetLibrary'
import {
  assetShotThumbUrl,
  analysisNotesFromAnalyzeResponse,
  placeOptionsForHit,
  previewShotToOpen,
  secondsFromStartMs,
  shotRangeLabel,
  type PlaceAssetOptions,
  type StoryAnalysisNote,
  type StoryPreviewDescription,
  type StoryPreviewShot,
} from './story-preview-helpers'

type StoryAssetPreviewModalProps = {
  productId: string
  projectId: string
  assetId: string
  seedCaption?: string | null
  seedTags?: string[]
  seedKind?: string | null
  initialShotId?: string
  initialStartMs?: number
  gallery: GalleryAsset | undefined
  placementDisabled?: boolean
  onClose: () => void
  onPlaceAsset: (assetId: string, options?: PlaceAssetOptions) => Promise<void>
  onEnsureAsset?: (assetId: string) => Promise<GalleryAsset>
  onReferenceAsset: (assetId: string) => Promise<void>
  /** Add current asset (and optional active shot) to Director basket (#174). */
  onAddToBasket?: (shotId?: string) => void
}

export const StoryAssetPreviewModal = ({
  productId,
  projectId,
  assetId,
  seedCaption,
  seedTags,
  seedKind,
  initialShotId,
  initialStartMs,
  gallery,
  placementDisabled,
  onClose,
  onPlaceAsset,
  onEnsureAsset,
  onReferenceAsset,
  onAddToBasket,
}: StoryAssetPreviewModalProps) => {
  const titleId = useId()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [description, setDescription] = useState<StoryPreviewDescription | null>(null)
  const [resolvedGallery, setResolvedGallery] = useState<GalleryAsset | undefined>(gallery)
  const [activeShotId, setActiveShotId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'place' | 'reference' | null>(null)
  const [analysisNotes, setAnalysisNotes] = useState<StoryAnalysisNote[]>([])
  const [analysisLoadError, setAnalysisLoadError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && busy === null) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      setAnalysisNotes([])
      setAnalysisLoadError(null)
      try {
        let nextGallery = gallery
        if (!nextGallery && onEnsureAsset) {
          nextGallery = await onEnsureAsset(assetId)
        }
        if (cancelled) return
        setResolvedGallery(nextGallery)

        const params = new URLSearchParams({ productId })
        const [indexRes, analyzeRes] = await Promise.all([
          fetch(`/api/studio/assets/${assetId}/index?${params}`),
          fetch(`/api/studio/assets/${assetId}/analyze?${params}`),
        ])
        const body = (await indexRes.json().catch(() => ({}))) as {
          asset?: StoryPreviewDescription
          error?: string
        }
        if (!indexRes.ok) {
          throw new Error(body.error ?? `Couldn't load this preview (${indexRes.status})`)
        }
        const analyzeBody = (await analyzeRes.json().catch(() => ({}))) as {
          analyses?: Array<{ kind: string; result: Record<string, unknown> }>
        }
        if (cancelled) return
        const asset = body.asset ?? null
        setDescription(asset)
        const loaded = analysisNotesFromAnalyzeResponse({
          ok: analyzeRes.ok,
          analyses: analyzeBody.analyses ?? [],
        })
        setAnalysisNotes(loaded.notes)
        setAnalysisLoadError(loaded.loadError)
        const openShot = previewShotToOpen(asset?.shots ?? [], {
          shotId: initialShotId,
          startMs: initialStartMs,
        })
        setActiveShotId(openShot?.id ?? null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Preview failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [assetId, gallery, initialShotId, initialStartMs, onEnsureAsset, productId])

  const kind = resolvedGallery?.kind ?? seedKind
  const canPlace = kind === 'video' || kind === 'audio'
  const caption =
    description?.caption?.trim() ||
    seedCaption?.trim() ||
    (typeof resolvedGallery?.probe?.name === 'string' ? resolvedGallery.probe.name.trim() : '') ||
    'Indexed asset'
  const tags = description?.tags?.length ? description.tags : (seedTags ?? [])
  const shots = description?.shots ?? []
  const activeShot = shots.find((shot) => shot.id === activeShotId) ?? shots[0] ?? null
  const mediaSrc = resolvedGallery ? assetContentUrl(projectId, resolvedGallery.id) : null
  const posterSrc = resolvedGallery ? assetPosterUrl(projectId, resolvedGallery) : null
  const activeThumb =
    activeShot?.thumbBlobKey && resolvedGallery
      ? assetShotThumbUrl(projectId, resolvedGallery.id, activeShot.id)
      : null

  const seekToShot = (shot: StoryPreviewShot | null, play: boolean) => {
    const media = resolvedGallery?.kind === 'audio' ? audioRef.current : videoRef.current
    if (!media || !shot) return
    media.currentTime = secondsFromStartMs(shot.startMs)
    if (play) void media.play().catch(() => undefined)
  }

  const onSelectShot = (shot: StoryPreviewShot) => {
    setActiveShotId(shot.id)
    seekToShot(shot, true)
  }

  useEffect(() => {
    const media = resolvedGallery?.kind === 'audio' ? audioRef.current : videoRef.current
    if (!media || !activeShot) return
    const apply = () => {
      media.currentTime = secondsFromStartMs(activeShot.startMs)
    }
    if (media.readyState >= 1) {
      apply()
      return
    }
    media.addEventListener('loadedmetadata', apply)
    return () => media.removeEventListener('loadedmetadata', apply)
  }, [activeShot, resolvedGallery?.kind])

  return (
    <div className="dialog-root story-preview-root" role="presentation">
      <button
        type="button"
        className="dialog-backdrop"
        onClick={() => {
          if (busy === null) onClose()
        }}
        aria-label="Close"
      />
      <div
        className="dialog-panel story-preview-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="story-preview-header">
          <div className="story-preview-heading">
            <p className="story-preview-kicker muted">Preview</p>
            <h2 id={titleId} className="dialog-title">
              {caption}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy !== null}
            onClick={onClose}
          >
            Close
          </button>
        </header>

        {loading ? <p className="muted story-preview-status">Loading shots…</p> : null}
        {error ? (
          <p className="story-preview-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="story-preview-body">
          <div className="story-preview-media" aria-hidden={!mediaSrc}>
            {kind === 'image' && mediaSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeThumb ?? mediaSrc} alt="" />
            ) : null}
            {kind === 'video' && mediaSrc ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                ref={videoRef}
                key={resolvedGallery?.id}
                src={mediaSrc}
                poster={activeThumb ?? posterSrc ?? undefined}
                controls
                playsInline
                onLoadedMetadata={() => seekToShot(activeShot, false)}
              />
            ) : null}
            {kind === 'audio' && mediaSrc ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio
                ref={audioRef}
                src={mediaSrc}
                controls
                onLoadedMetadata={() => seekToShot(activeShot, false)}
              />
            ) : null}
            {!mediaSrc && !loading ? (
              <p className="muted">Media not on this project yet — use Reference to attach.</p>
            ) : null}
          </div>

          <aside className="story-preview-meta">
            {tags.length > 0 ? (
              <div className="story-preview-tags" aria-label="Tags">
                {tags.slice(0, 8).map((item) => (
                  <span key={item} className="story-builder-tag is-static">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
            {description?.transcriptExcerpt ? (
              <p className="muted story-preview-transcript">{description.transcriptExcerpt}</p>
            ) : null}
            {analysisLoadError ? (
              <section className="story-preview-notes" aria-label="Analysis notes">
                <strong className="story-preview-shots-label">Analysis</strong>
                <p className="story-preview-error" role="alert">
                  {analysisLoadError}
                </p>
              </section>
            ) : analysisNotes.length > 0 ? (
              <section className="story-preview-notes" aria-label="Analysis notes">
                <strong className="story-preview-shots-label">Analysis</strong>
                <ul>
                  {analysisNotes.map((note, index) => (
                    <li key={`${note.kind}-${index}`}>
                      <span className="muted">{note.kind}</span> {note.text}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {shots.length > 0 ? (
              <div className="story-preview-shots" role="listbox" aria-label="Shots">
                <strong className="story-preview-shots-label">Shots</strong>
                <ul className="story-preview-shot-list">
                  {shots.map((shot) => {
                    const selected = shot.id === activeShot?.id
                    const thumb =
                      shot.thumbBlobKey && resolvedGallery
                        ? assetShotThumbUrl(projectId, resolvedGallery.id, shot.id)
                        : null
                    return (
                      <li key={shot.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={
                            selected ? 'story-preview-shot is-active' : 'story-preview-shot'
                          }
                          onClick={() => onSelectShot(shot)}
                        >
                          <span className="story-preview-shot-thumb" aria-hidden>
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb} alt="" />
                            ) : (
                              <span>{shot.ordinal + 1}</span>
                            )}
                          </span>
                          <span className="story-preview-shot-meta">
                            Shot {shot.ordinal + 1}
                            <span className="muted">{shotRangeLabel(shot)}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : !loading ? (
              <p className="muted">No shot list yet — index may still be catching up.</p>
            ) : null}

            <div className="story-preview-actions">
              {canPlace ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={placementDisabled || busy !== null}
                  onClick={() => {
                    setBusy('place')
                    void onPlaceAsset(assetId, placeOptionsForHit(activeShot ?? {}))
                      .then(() => onClose())
                      .catch((err) => {
                        setError(err instanceof Error ? err.message : 'Place failed')
                      })
                      .finally(() => setBusy(null))
                  }}
                >
                  {busy === 'place' ? 'Placing…' : 'Place'}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={() => {
                  setBusy('reference')
                  void onReferenceAsset(assetId)
                    .then(() => onClose())
                    .catch((err) => {
                      setError(err instanceof Error ? err.message : 'Reference failed')
                    })
                    .finally(() => setBusy(null))
                }}
              >
                {busy === 'reference' ? 'Referencing…' : 'Reference'}
              </button>
              {onAddToBasket ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy !== null}
                  onClick={() => {
                    onAddToBasket(activeShot?.id)
                  }}
                >
                  Add to basket
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
