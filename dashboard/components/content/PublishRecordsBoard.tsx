'use client'

import { useEffect, useState } from 'react'
import type { PublishRecord } from '@synawood/channels'
import {
  channelLabel,
  PastePostedUrl,
  publishStatusLabel,
} from '@/components/content/PastePostedUrl'
import {
  failedPublishCause,
  failedPublishHeadline,
  failedPublishPageBanner,
} from '@/lib/publish-failed-copy'
import { PASTE_URL_ALWAYS_AVAILABLE_HINT } from '@/lib/paste-posted-copy'
import { StudioSpinner } from '@/components/studio/StudioSpinner'

/**
 * Interim Content surface until Plan 05 slice 3 (week board).
 * Paste post links for opens that were started from Studio.
 */
export const PublishRecordsBoard = ({ productId }: { productId: string }) => {
  const [records, setRecords] = useState<PublishRecord[]>([])
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [retryNotes, setRetryNotes] = useState<Record<string, string>>({})

  const loadRecords = async (): Promise<PublishRecord[]> => {
    const response = await fetch(`/api/studio/publish?productId=${productId}`)
    const body = (await response.json()) as { records?: PublishRecord[]; error?: string }
    if (!response.ok) throw new Error(body.error ?? 'Failed to load')
    const next = body.records ?? []
    setRecords(next)
    return next
  }

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      await loadRecords()
    } catch {
      setError('Couldn’t load posts. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [productId])

  const runPublishAction = (work: () => Promise<void>, fallback: string) => {
    setPending(true)
    setError(null)
    void (async () => {
      try {
        await work()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : fallback)
      } finally {
        setPending(false)
      }
    })()
  }

  const onPasteUrl = (publishId: string) => {
    const postedUrl = (urlDrafts[publishId] ?? '').trim()
    runPublishAction(async () => {
      const response = await fetch(`/api/studio/publish/${publishId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postedUrl }),
      })
      if (!response.ok) throw new Error('Paste the full post link, starting with https://')
      setUrlDrafts((prev) => {
        const next = { ...prev }
        delete next[publishId]
        return next
      })
      setRetryNotes((prev) => {
        const next = { ...prev }
        delete next[publishId]
        return next
      })
      await loadRecords()
    }, 'Paste the full post link, starting with https://')
  }

  const onRetry = (publishId: string) => {
    runPublishAction(async () => {
      const response = await fetch(`/api/studio/publish/${publishId}`)
      const body = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Failed to refresh')
      const next = await loadRecords()
      const row = next.find((record) => record.id === publishId)
      if (row?.status === 'failed') {
        setRetryNotes((prev) => ({
          ...prev,
          [publishId]:
            'Still failed. Postiz has not recovered this post. Cancel it, or paste the live URL.',
        }))
        return
      }
      setRetryNotes((prev) => {
        const nextNotes = { ...prev }
        delete nextNotes[publishId]
        return nextNotes
      })
    }, 'Couldn’t check Postiz for this post. Try again.')
  }

  const onCancel = (publishId: string) => {
    runPublishAction(async () => {
      const response = await fetch(`/api/studio/publish/${publishId}`, { method: 'DELETE' })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Failed to cancel')
      setRetryNotes((prev) => {
        const next = { ...prev }
        delete next[publishId]
        return next
      })
      await loadRecords()
    }, 'Couldn’t cancel. Try again.')
  }

  const failed = records.filter((record) => record.status === 'failed')
  const open = records.filter(
    (record) => record.status === 'ready' || record.status === 'scheduled',
  )
  const posted = records.filter(
    (record) => record.status === 'manual_posted' || record.status === 'posted',
  )

  return (
    <div className="publish-records-board">
      {loading ? <StudioSpinner size="sm" label="Loading" /> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading ? (
        <p className="muted" role="status">
          {PASTE_URL_ALWAYS_AVAILABLE_HINT}
        </p>
      ) : null}
      {failed.length > 0 ? (
        <div className="publish-failed-page-banner" role="alert">
          {failedPublishPageBanner(failed)}
        </div>
      ) : null}
      {!loading && records.length === 0 ? (
        <p className="muted">No posts yet. Approve a Studio cut, then post from there.</p>
      ) : null}

      {failed.length > 0 ? (
        <ul className="publish-record-list publish-record-list-failed">
          {failed.map((record) => (
            <li key={record.id} className="publish-record publish-record-failed">
              <div className="publish-failed-banner" role="status">
                <p>
                  <strong>{failedPublishHeadline(record)}</strong> {failedPublishCause(record)}
                </p>
                {retryNotes[record.id] ? (
                  <p className="publish-failed-retry-note">{retryNotes[record.id]}</p>
                ) : null}
                <div className="publish-failed-actions">
                  <button type="button" disabled={pending} onClick={() => onRetry(record.id)}>
                    Try again
                  </button>
                  <button type="button" disabled={pending} onClick={() => onCancel(record.id)}>
                    Cancel
                  </button>
                </div>
              </div>
              <PastePostedUrl
                value={urlDrafts[record.id] ?? ''}
                disabled={pending}
                onChange={(value) => setUrlDrafts((prev) => ({ ...prev, [record.id]: value }))}
                onSave={() => onPasteUrl(record.id)}
                saveLabel="Mark as posted"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {open.length > 0 ? (
        <ul className="publish-record-list">
          {open.map((record) => (
            <li key={record.id} className="publish-record">
              <div className="publish-record-meta">
                <strong>{channelLabel(record.channel)}</strong>
                <span className={`publish-status is-${record.status}`}>
                  {publishStatusLabel(record.status)}
                </span>
              </div>
              <PastePostedUrl
                value={urlDrafts[record.id] ?? ''}
                disabled={pending}
                onChange={(value) => setUrlDrafts((prev) => ({ ...prev, [record.id]: value }))}
                onSave={() => onPasteUrl(record.id)}
                saveLabel="Mark as posted"
              />
              <button type="button" disabled={pending} onClick={() => onCancel(record.id)}>
                Cancel
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {posted.length > 0 ? (
        <ul className="publish-record-list publish-record-list-done">
          {posted.map((record) => (
            <li key={record.id} className="publish-record">
              <div className="publish-record-meta">
                <strong>{channelLabel(record.channel)}</strong>
                <span className="publish-status is-manual_posted">Posted</span>
              </div>
              {record.externalUrl ? (
                <a href={record.externalUrl} target="_blank" rel="noreferrer">
                  View post
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
