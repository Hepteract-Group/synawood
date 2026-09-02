'use client'

import {
  indexingChipLabel,
  visitorLibraryError,
  type AssetIndexStatusItem,
  type AssetIndexStatusSummary,
} from '@synawood/creative/asset-intelligence/index-status'
import { isPaidIndexSoftSkip } from '@synawood/creative/asset-intelligence/soft-skip'
import { isKeyframeThumbsMissing } from '@synawood/creative/asset-intelligence/thumbs-missing'
import {
  isUnrecoverableIndexError,
  isVisualEmbedFailed,
} from '@synawood/creative/asset-intelligence/visual-embed-status'
import { useEffect, useRef, useState } from 'react'

type IndexStatusResponse = {
  items: AssetIndexStatusItem[]
  summary: AssetIndexStatusSummary
  unindexedCount?: number
  unindexedAssetIds?: string[]
  backfillCount?: number
  backfillAssetIds?: string[]
}

type IndexingProgressChipProps = {
  productId: string
  projectId: string
  /** Bump after upload so we re-poll immediately. */
  revision: number
}

const POLL_MS = 2000
/** Enough batches for a large library, plus a couple retries — not unbounded. */
const MAX_BACKFILL_ROUNDS = 24

export const IndexingProgressChip = ({
  productId,
  projectId,
  revision,
}: IndexingProgressChipProps) => {
  const [payload, setPayload] = useState<IndexStatusResponse | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pollEpoch, setPollEpoch] = useState(0)
  const backfillInFlightRef = useRef(false)
  const backfillRoundsRef = useRef(0)
  const backfillStoppedRef = useRef(false)

  useEffect(() => {
    backfillRoundsRef.current = 0
    backfillStoppedRef.current = false
  }, [productId, projectId, revision])

  useEffect(() => {
    if (!productId || !projectId) {
      setPayload(null)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedulePoll = (ms: number) => {
      timer = setTimeout(() => {
        void load()
      }, ms)
    }

    const load = async () => {
      try {
        const params = new URLSearchParams({ productId, projectId })
        const res = await fetch(`/api/studio/assets/index-status?${params}`)
        const body = (await res.json().catch(() => ({}))) as IndexStatusResponse & {
          error?: string
        }
        if (!res.ok) {
          throw new Error(body.error ?? `Couldn't check library status (${res.status})`)
        }
        if (cancelled) return
        setPayload(body)
        setError(null)

        const remaining = body.backfillCount ?? body.unindexedCount ?? 0
        const canBackfill =
          remaining > 0 &&
          !backfillInFlightRef.current &&
          !backfillStoppedRef.current &&
          backfillRoundsRef.current < MAX_BACKFILL_ROUNDS

        if (canBackfill) {
          backfillInFlightRef.current = true
          backfillRoundsRef.current += 1
          try {
            const missingRes = await fetch('/api/studio/assets/index-missing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId, projectId, limit: 8 }),
            })
            const missingBody = (await missingRes.json().catch(() => ({}))) as {
              error?: string
              attempted?: number
              remaining?: number
            }
            if (cancelled) return
            if (!missingRes.ok) {
              backfillStoppedRef.current = true
              setError(
                missingBody.error ?? `Couldn't finish preparing files (${missingRes.status})`,
              )
              return
            }
            if ((missingBody.attempted ?? 0) === 0) {
              backfillStoppedRef.current = true
            }
            setPollEpoch((epoch) => epoch + 1)
          } finally {
            backfillInFlightRef.current = false
          }
          return
        }

        if (body.summary.active > 0 || (remaining > 0 && !backfillStoppedRef.current)) {
          schedulePoll(POLL_MS)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Couldn't check library status")
        schedulePoll(POLL_MS * 2)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [productId, projectId, revision, pollEpoch])

  const onRetry = async (assetId: string) => {
    setRetryingId(assetId)
    setError(null)
    try {
      const res = await fetch(`/api/studio/assets/${assetId}/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, projectId, confirmSpend: true }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? `Couldn't retry (${res.status})`)
      }
      backfillStoppedRef.current = false
      setPollEpoch((epoch) => epoch + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't retry")
    } finally {
      setRetryingId(null)
    }
  }

  if (!payload) {
    if (!error) return null
    return (
      <div className="indexing-status-chip is-failed" role="status" aria-live="polite">
        <span className="indexing-status-chip-copy">{error}</span>
      </div>
    )
  }

  const remaining = payload.backfillCount ?? payload.unindexedCount ?? 0
  const failedItems = payload.items.filter(
    (item) => item.status === 'failed' && !isUnrecoverableIndexError(item.lastError),
  )
  const softSkippedItems = payload.items.filter(
    (item) => item.status === 'ready' && isPaidIndexSoftSkip(item.lastError),
  )
  const thumbsMissingItems = payload.items.filter(
    (item) => item.status === 'ready' && isKeyframeThumbsMissing(item.lastError),
  )
  const visualFailedItems = payload.items.filter(
    (item) =>
      item.status === 'ready' &&
      isVisualEmbedFailed(item.lastError) &&
      !isKeyframeThumbsMissing(item.lastError),
  )
  const summary = {
    ...payload.summary,
    softSkipped: payload.summary.softSkipped ?? softSkippedItems.length,
    thumbsMissing: payload.summary.thumbsMissing ?? thumbsMissingItems.length,
    visualFailed: payload.summary.visualFailed ?? visualFailedItems.length,
  }
  const label = remaining > 0 ? `Preparing library… ${remaining} left` : indexingChipLabel(summary)
  if (!label && !error) return null

  const tone =
    summary.active > 0 || remaining > 0
      ? 'is-active'
      : failedItems.length > 0
        ? 'is-failed'
        : thumbsMissingItems.length > 0 ||
            visualFailedItems.length > 0 ||
            softSkippedItems.length > 0
          ? 'is-soft'
          : 'is-ready'

  return (
    <div className={`indexing-status-chip ${tone}`} role="status" aria-live="polite">
      <div className="indexing-status-chip-main">
        <strong>{label ?? 'Library status'}</strong>
        {summary.active > 0 || remaining > 0 ? (
          <span className="muted indexing-status-chip-stage">
            Search starts when files are ready. Names work right away.
          </span>
        ) : null}
        {thumbsMissingItems.length > 0 && failedItems.length === 0 ? (
          <span className="muted indexing-status-chip-stage">
            Preview stills didn’t save. Retry to generate them.
          </span>
        ) : null}
        {visualFailedItems.length > 0 &&
        failedItems.length === 0 &&
        thumbsMissingItems.length === 0 ? (
          <span className="muted indexing-status-chip-stage">
            Text search is ready. Retry may learn how this file looks.
          </span>
        ) : null}
        {softSkippedItems.length > 0 &&
        failedItems.length === 0 &&
        thumbsMissingItems.length === 0 &&
        visualFailedItems.length === 0 ? (
          <span className="muted indexing-status-chip-stage">
            Captions and look-matching need extra processing turned on.
          </span>
        ) : null}
        {error ? <span className="indexing-status-chip-error">{error}</span> : null}
      </div>
      {failedItems.length > 0 ? (
        <ul className="indexing-status-chip-failures">
          {failedItems.slice(0, 3).map((item) => (
            <li key={item.assetId}>
              <span className="indexing-status-chip-reason">
                {visitorLibraryError(item.lastError, "Couldn't prepare this file")}
              </span>
              <button
                type="button"
                className="btn btn-ghost indexing-status-chip-retry"
                disabled={retryingId === item.assetId}
                onClick={() => void onRetry(item.assetId)}
              >
                {retryingId === item.assetId ? 'Retrying…' : 'Retry'}
              </button>
            </li>
          ))}
          {Math.max(0, failedItems.length - 3) > 0 ? (
            <li className="muted indexing-status-chip-reason">+{failedItems.length - 3} more</li>
          ) : null}
        </ul>
      ) : null}
      {thumbsMissingItems.length > 0 ? (
        <ul className="indexing-status-chip-soft">
          {thumbsMissingItems.slice(0, 3).map((item) => (
            <li key={item.assetId}>
              <span className="indexing-status-chip-reason">
                {visitorLibraryError(item.lastError, 'Preview stills didn’t save')}
              </span>
              <button
                type="button"
                className="btn btn-ghost indexing-status-chip-retry"
                disabled={retryingId === item.assetId}
                onClick={() => void onRetry(item.assetId)}
              >
                {retryingId === item.assetId ? 'Retrying…' : 'Retry'}
              </button>
            </li>
          ))}
          {Math.max(0, thumbsMissingItems.length - 3) > 0 ? (
            <li className="muted indexing-status-chip-reason">
              +{thumbsMissingItems.length - 3} more
            </li>
          ) : null}
        </ul>
      ) : null}
      {visualFailedItems.length > 0 ? (
        <ul className="indexing-status-chip-soft">
          {visualFailedItems.slice(0, 3).map((item) => (
            <li key={item.assetId}>
              <span className="indexing-status-chip-reason">
                {visitorLibraryError(item.lastError, "Couldn't match how this file looks")}
              </span>
              <button
                type="button"
                className="btn btn-ghost indexing-status-chip-retry"
                disabled={retryingId === item.assetId}
                onClick={() => void onRetry(item.assetId)}
              >
                {retryingId === item.assetId ? 'Retrying…' : 'Retry'}
              </button>
            </li>
          ))}
          {Math.max(0, visualFailedItems.length - 3) > 0 ? (
            <li className="muted indexing-status-chip-reason">
              +{visualFailedItems.length - 3} more
            </li>
          ) : null}
        </ul>
      ) : null}
      {softSkippedItems.length > 0 ? (
        <ul className="indexing-status-chip-soft">
          {softSkippedItems.slice(0, 3).map((item) => (
            <li key={item.assetId}>
              <span className="indexing-status-chip-reason">
                {visitorLibraryError(item.lastError, 'Extra processing was skipped')}
              </span>
              <button
                type="button"
                className="btn btn-ghost indexing-status-chip-retry"
                disabled={retryingId === item.assetId}
                onClick={() => void onRetry(item.assetId)}
              >
                {retryingId === item.assetId ? 'Retrying…' : 'Retry'}
              </button>
            </li>
          ))}
          {Math.max(0, softSkippedItems.length - 3) > 0 ? (
            <li className="muted indexing-status-chip-reason">
              +{softSkippedItems.length - 3} more
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
