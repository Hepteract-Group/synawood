'use client'

/**
 * Story Builder — Media bin mode (#171 + #172 preview).
 *
 * THESIS: Retrieve indexed footage inside the bin — not a second editor.
 * OWN-WORLD: Studio Operate tokens (--sw-*), same tab/chip language as Media bin.
 * STORY: Search or tag-filter → captioned hits → preview / Place / Reference.
 * FIRST VIEWPORT: Library|Story switch, search field, results or empty CTA.
 * FORM: Extension of AssetBin (ADR-0032 / story-builder UX).
 */

import {
  isActiveIndexStatus,
  needsAppearanceIndex,
} from '@synawood/creative/asset-intelligence/index-status'
import { assetTokenFor } from '@synawood/creative/project/asset-token'
import { useEffect, useId, useRef, useState } from 'react'
import { IconAt, IconLayers, IconSearch } from '../icons'
import { assetContentUrl, assetPosterUrl, type GalleryAsset } from './AssetLibrary'
import { DirectorBasketPanel } from './DirectorBasketPanel'
import { StoryAssetPreviewModal } from './StoryAssetPreviewModal'
import {
  assetShotThumbUrl,
  hitRangeLabel,
  placeOptionsForHit,
  type PlaceAssetOptions,
} from './story-preview-helpers'
import { useDirectorBasket } from './useDirectorBasket'

/** Mirrors GET /api/studio/assets/search|moments|by-tag hit shape (client-safe; no barrel). */
type StorySearchHit = {
  assetId: string
  productId?: string
  caption: string | null
  transcriptExcerpt: string | null
  tags: string[]
  distance: number | null
  kind: string | null
  shotId?: string
  startMs?: number
  endMs?: number | null
  score?: number
}

type StoryBuilderProps = {
  productId: string
  projectId: string
  assets: GalleryAsset[]
  placementDisabled?: boolean
  onPlaceAsset: (assetId: string, options?: PlaceAssetOptions) => Promise<void>
  /** Attach product-library asset onto project JSON without placing (#441). */
  onEnsureAsset?: (assetId: string) => Promise<GalleryAsset>
  onReferenceAsset: (token: string) => void
}

const DEBOUNCE_MS = 280
const EXAMPLE_QUERIES = ['product', 'travel'] as const

export const debounceMsForTests = DEBOUNCE_MS
export const APPEARANCE_NEEDS_INDEX_COPY = 'Matching by look isn’t ready yet — Retry'

const assetById = (assets: GalleryAsset[], id: string): GalleryAsset | undefined =>
  assets.find((asset) => asset.id === id)

export const StoryBuilder = ({
  productId,
  projectId,
  assets,
  placementDisabled,
  onPlaceAsset,
  onEnsureAsset,
  onReferenceAsset,
}: StoryBuilderProps) => {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [hits, setHits] = useState<StorySearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placingId, setPlacingId] = useState<string | null>(null)
  const [previewHit, setPreviewHit] = useState<StorySearchHit | null>(null)
  const [appearanceBlockedId, setAppearanceBlockedId] = useState<string | null>(null)
  const [appearanceBusy, setAppearanceBusy] = useState(false)
  const [appearanceIndexing, setAppearanceIndexing] = useState(false)
  const appearanceRetryAtRef = useRef(0)
  const basket = useDirectorBasket(projectId)

  const addHitToBasket = (hit: StorySearchHit, shotId?: string) => {
    basket.add({
      assetId: hit.assetId,
      shotId,
      caption: hit.caption ?? undefined,
      kind: hit.kind,
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!tag && !debouncedQuery) {
        setHits([])
        setError(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ productId })
        let path = '/api/studio/assets/moments'
        if (tag) {
          path = '/api/studio/assets/by-tag'
          params.set('tag', tag)
        } else {
          const uuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              debouncedQuery,
            )
          if (uuid) params.set('imageAssetId', debouncedQuery)
          else params.set('q', debouncedQuery)
        }
        const res = await fetch(`${path}?${params}`)
        const body = (await res.json().catch(() => ({}))) as {
          hits?: StorySearchHit[]
          error?: string
        }
        if (!res.ok) {
          throw new Error(body.error ?? `Search failed (${res.status})`)
        }
        if (cancelled) return
        setHits(body.hits ?? [])
      } catch (err) {
        if (cancelled) return
        setHits([])
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [productId, debouncedQuery, tag])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const load = async () => {
      const params = new URLSearchParams({ productId, projectId })
      const res = await fetch(`/api/studio/assets/index-status?${params}`)
      const body = (await res.json().catch(() => ({}))) as {
        items?: Array<{
          assetId: string
          status: string
          lastError: string | null
          hasVisualEmbedding?: boolean
        }>
      }
      if (cancelled || !res.ok) return
      const items = body.items ?? []
      const blocked = items.find(needsAppearanceIndex)
      const indexing = items.some((item) => isActiveIndexStatus(item.status))
      setAppearanceBlockedId(blocked?.assetId ?? null)
      setAppearanceIndexing(indexing)
      const retryWaitedTooLong =
        appearanceBusy &&
        !indexing &&
        appearanceRetryAtRef.current > 0 &&
        Date.now() - appearanceRetryAtRef.current > 12_000
      if (indexing || retryWaitedTooLong || (appearanceBusy && !indexing && !blocked)) {
        setAppearanceBusy(false)
      }
      if (indexing || appearanceBusy) {
        timer = setTimeout(() => {
          void load()
        }, 2000)
      }
    }
    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [productId, projectId, appearanceBusy])

  const onRetryAppearance = async () => {
    if (!appearanceBlockedId) return
    setAppearanceBusy(true)
    appearanceRetryAtRef.current = Date.now()
    setError(null)
    try {
      const res = await fetch(`/api/studio/assets/${appearanceBlockedId}/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, projectId, confirmSpend: true }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Retry failed')
    } catch (err) {
      setAppearanceBusy(false)
      setError(err instanceof Error ? err.message : 'Retry failed')
    }
  }

  const suggestedTags = [...new Set(hits.flatMap((hit) => hit.tags).filter(Boolean))].slice(0, 8)

  const onPlace = async (hit: StorySearchHit) => {
    setPlacingId(hit.assetId)
    setError(null)
    try {
      await onPlaceAsset(hit.assetId, placeOptionsForHit(hit))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Place failed')
    } finally {
      setPlacingId(null)
    }
  }

  const onReference = async (assetId: string) => {
    setError(null)
    try {
      let gallery = assetById(assets, assetId)
      if (!gallery) {
        if (!onEnsureAsset) {
          throw new Error('Asset is not on this project yet — Place it first, or open Library.')
        }
        gallery = await onEnsureAsset(assetId)
      }
      onReferenceAsset(assetTokenFor(gallery))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reference failed'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    }
  }

  const noLocalMedia = assets.length === 0
  const idle = !tag && !debouncedQuery

  const applyExample = (phrase: string) => {
    setTag(null)
    setQuery(phrase)
  }

  return (
    <div className="story-builder" aria-label="Story Builder">
      <p className="story-builder-lede muted">Find a moment. Select a frame to preview shots.</p>
      {appearanceIndexing || appearanceBusy || appearanceBlockedId ? (
        <div className="story-builder-appearance" role="status" aria-live="polite">
          <p>
            {appearanceIndexing
              ? 'Still preparing matching by look.'
              : appearanceBusy
                ? 'Retry started. This can take a minute.'
                : APPEARANCE_NEEDS_INDEX_COPY}
          </p>
          {!appearanceIndexing && !appearanceBusy && appearanceBlockedId ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void onRetryAppearance()}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="story-builder-controls">
        <label className="story-builder-search" htmlFor={searchId}>
          <IconSearch className="story-builder-search-icon" />
          <span className="visually-hidden">Search assets</span>
          <input
            id={searchId}
            type="search"
            value={query}
            disabled={Boolean(tag)}
            placeholder={tag ? `Tagged “${tag}”` : 'funny take, product close-up…'}
            onChange={(event) => {
              setQuery(event.target.value)
              if (tag) setTag(null)
            }}
            autoComplete="off"
          />
        </label>
        {tag ? (
          <button
            type="button"
            className="story-builder-tag is-active"
            onClick={() => setTag(null)}
            aria-pressed="true"
          >
            {tag} ×
          </button>
        ) : null}
      </div>

      {idle && !noLocalMedia ? (
        <div className="story-builder-tags" role="group" aria-label="Try a moment">
          {EXAMPLE_QUERIES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              className="story-builder-tag"
              onClick={() => applyExample(phrase)}
            >
              {phrase}
            </button>
          ))}
        </div>
      ) : null}

      {suggestedTags.length > 0 ? (
        <div className="story-builder-tags" role="group" aria-label="Suggested tags">
          {suggestedTags.map((item) => (
            <button
              key={item}
              type="button"
              className={tag === item ? 'story-builder-tag is-active' : 'story-builder-tag'}
              onClick={() => {
                setTag(tag === item ? null : item)
                setQuery('')
              }}
              aria-pressed={tag === item}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="story-builder-error" role="alert">
          {error}
        </p>
      ) : null}

      {noLocalMedia && idle ? (
        <div className="story-builder-empty">
          <strong>Add files to search them</strong>
          <p className="muted">
            Switch to Library and upload. Search starts when files are ready. The status note above
            shows progress.
          </p>
        </div>
      ) : null}

      {!noLocalMedia && idle ? (
        <div className="story-builder-empty">
          <strong>Ask for a moment</strong>
          <p className="muted">Type above, or tap a chip — product or travel.</p>
        </div>
      ) : null}

      {loading ? (
        <ul className="story-builder-results" aria-busy="true" aria-label="Searching">
          {[0, 1, 2].map((slot) => (
            <li key={slot} className="story-builder-hit is-skeleton" aria-hidden>
              <div className="story-builder-hit-preview" />
              <div className="story-builder-hit-body">
                <span className="story-builder-skel-line" />
                <span className="story-builder-skel-line is-short" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !idle && hits.length === 0 && !error ? (
        <p className="muted story-builder-status">
          No close matches. Try a tag chip, or a more specific phrase — weak semantic hits are
          hidden.
        </p>
      ) : null}

      {!loading && hits.length > 0 ? (
        <ul className="story-builder-results">
          {hits.map((hit) => {
            const gallery = assetById(assets, hit.assetId)
            const kind = gallery?.kind ?? hit.kind
            const canPlace = kind === 'video' || kind === 'audio'
            const poster = gallery ? assetPosterUrl(projectId, gallery) : null
            const range = hitRangeLabel(hit)
            const imageUrl =
              (hit.shotId ? assetShotThumbUrl(projectId, hit.assetId, hit.shotId) : null) ??
              poster ??
              (gallery?.kind === 'image' ? assetContentUrl(projectId, gallery.id) : null) ??
              gallery?.signedUrl ??
              null
            const caption = hit.caption?.trim() || 'Indexed asset'
            return (
              <li key={`${hit.assetId}:${hit.shotId ?? 'asset'}`} className="story-builder-hit">
                <button
                  type="button"
                  className="story-builder-hit-open"
                  onClick={() => setPreviewHit(hit)}
                  aria-label={`Preview ${caption}`}
                >
                  <div className="story-builder-hit-preview" aria-hidden>
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="" />
                    ) : (
                      <span className="story-builder-hit-glyph">
                        {(kind ?? 'media').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    {kind ? <span className="story-builder-hit-kind">{kind}</span> : null}
                    {range ? <span className="story-builder-hit-range">{range}</span> : null}
                  </div>
                </button>
                <div className="story-builder-hit-body">
                  <p className="story-builder-hit-caption">{caption}</p>
                  {hit.tags.length > 0 ? (
                    <div className="story-builder-hit-tags" aria-label="Tags">
                      {hit.tags.slice(0, 3).map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="story-builder-tag"
                          onClick={() => {
                            setTag(item)
                            setQuery('')
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="story-builder-hit-actions">
                    {canPlace ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={placementDisabled || placingId === hit.assetId}
                        onClick={() => void onPlace(hit)}
                      >
                        {placingId === hit.assetId ? 'Placing…' : 'Place'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void onReference(hit.assetId)}
                    >
                      <IconAt />
                      <span>Reference</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => addHitToBasket(hit)}
                      aria-label="Add to basket"
                    >
                      <IconLayers />
                      <span>Basket</span>
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      <DirectorBasketPanel
        items={basket.items}
        onRemove={basket.remove}
        onClear={basket.clear}
        onUseInDirector={() => {
          const prompt = basket.prompt
          if (!prompt) return
          onReferenceAsset(prompt)
        }}
      />

      {previewHit ? (
        <StoryAssetPreviewModal
          productId={productId}
          projectId={projectId}
          assetId={previewHit.assetId}
          seedCaption={previewHit.caption}
          seedTags={previewHit.tags}
          seedKind={previewHit.kind}
          initialShotId={previewHit.shotId}
          initialStartMs={previewHit.startMs}
          gallery={assetById(assets, previewHit.assetId)}
          placementDisabled={placementDisabled}
          onClose={() => setPreviewHit(null)}
          onPlaceAsset={onPlaceAsset}
          onEnsureAsset={onEnsureAsset}
          onReferenceAsset={onReference}
          onAddToBasket={(shotId) => addHitToBasket(previewHit, shotId)}
        />
      ) : null}
    </div>
  )
}
