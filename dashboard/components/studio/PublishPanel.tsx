'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PublishChannel, PublishRecord } from '@synawood/channels'
import { channelLabel, PastePostedUrl } from '@/components/content/PastePostedUrl'
import { PASTE_URL_ALWAYS_AVAILABLE_HINT } from '@/lib/paste-posted-copy'
import { StudioSpinner } from '@/components/studio/StudioSpinner'
import {
  IconChannelBlog,
  IconChannelLinkedIn,
  IconChannelTikTok,
  IconChannelX,
  IconDownload,
  IconShare,
} from '@/components/icons'

const CHANNELS: PublishChannel[] = ['linkedin_founder', 'x_founder', 'blog_seo', 'tiktok_organic']

type PublishPanelProps = {
  projectId: string
  productId: string
  visible: boolean
}

type PublishListResponse = {
  final?: { id: string; primaryAssetId: string } | null
  records?: PublishRecord[]
  error?: string
}

const isPosted = (status: PublishRecord['status']) =>
  status === 'manual_posted' || status === 'posted'

const isOpen = (status: PublishRecord['status']) => status === 'ready' || status === 'scheduled'

const channelIcon = (channel: PublishChannel): ReactNode => {
  switch (channel) {
    case 'linkedin_founder':
      return <IconChannelLinkedIn />
    case 'x_founder':
      return <IconChannelX />
    case 'blog_seo':
      return <IconChannelBlog />
    case 'tiktok_organic':
      return <IconChannelTikTok />
    default:
      return <IconShare />
  }
}

const friendlyError = (message: string): string => {
  if (/final asset not found|no final/i.test(message)) {
    return 'Nothing to post yet — export and approve a cut first.'
  }
  if (/killed|discarded/i.test(message)) {
    return 'This cut was discarded, so it can’t be posted.'
  }
  if (/absolute http|posted url/i.test(message)) {
    return 'Paste the full post link, starting with https://'
  }
  return 'Something went wrong. Try again.'
}

const latestByChannel = (records: PublishRecord[]): Map<PublishChannel, PublishRecord> => {
  const map = new Map<PublishChannel, PublishRecord>()
  for (const record of records) {
    const existing = map.get(record.channel)
    if (!existing) {
      map.set(record.channel, record)
      continue
    }
    if (isPosted(record.status) && !isPosted(existing.status)) {
      map.set(record.channel, record)
    } else if (isOpen(record.status) && !isPosted(existing.status) && !isOpen(existing.status)) {
      map.set(record.channel, record)
    } else if (record.createdAt > existing.createdAt && existing.status === record.status) {
      map.set(record.channel, record)
    }
  }
  return map
}

/**
 * Compact workspace-bar chrome + dismissible modal.
 * Keeps Media / Chat / Player full height after Approve.
 */
export const PublishPanel = ({ projectId, productId, visible }: PublishPanelProps) => {
  const [records, setRecords] = useState<PublishRecord[]>([])
  const [hasFinal, setHasFinal] = useState(false)
  const [selected, setSelected] = useState<PublishChannel[]>(['linkedin_founder'])
  const [urlDrafts, setUrlDrafts] = useState<Partial<Record<PublishChannel, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [pendingChannel, setPendingChannel] = useState<PublishChannel | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  const byChannel = latestByChannel(records)
  const postedChannels = CHANNELS.filter((channel) => {
    const record = byChannel.get(channel)
    return record ? isPosted(record.status) : false
  })
  const openForLinks = CHANNELS.filter((channel) => {
    if (postedChannels.includes(channel)) return false
    if (selected.includes(channel)) return true
    const record = byChannel.get(channel)
    return record ? isOpen(record.status) : false
  })

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/studio/publish?projectId=${projectId}`)
      const body = (await response.json()) as PublishListResponse
      if (!response.ok) throw new Error(body.error ?? 'Failed to load')
      setHasFinal(Boolean(body.final?.id))
      const nextRecords = body.records ?? []
      setRecords(nextRecords)
      setSelected((prev) => {
        const fromServer = nextRecords
          .filter((record) => isPosted(record.status) || isOpen(record.status))
          .map((record) => record.channel)
        return Array.from(new Set([...prev, ...fromServer]))
      })
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Failed to load'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!visible) {
      setOpen(false)
      return
    }
    void reload()
  }, [visible, projectId])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!visible) return null

  const toggleChannel = (channel: PublishChannel) => {
    const record = byChannel.get(channel)
    if (record && isPosted(record.status)) return
    setSelected((prev) =>
      prev.includes(channel) ? prev.filter((item) => item !== channel) : [...prev, channel],
    )
  }

  const onMarkPosted = (channel: PublishChannel) => {
    const url = (urlDrafts[channel] ?? '').trim()
    if (!url) return
    setPendingChannel(channel)
    setError(null)
    void (async () => {
      try {
        const existing = byChannel.get(channel)
        let publishId = existing && isOpen(existing.status) ? existing.id : null
        if (!publishId) {
          const prepare = await fetch('/api/studio/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, projectId, channel }),
          })
          const prepared = (await prepare.json()) as {
            record?: PublishRecord
            error?: string
          }
          if (!prepare.ok || !prepared.record) {
            throw new Error(prepared.error ?? 'Failed to prepare')
          }
          publishId = prepared.record.id
        }

        const response = await fetch(`/api/studio/publish/${publishId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postedUrl: url }),
        })
        const body = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Failed to save')
        setUrlDrafts((prev) => {
          const next = { ...prev }
          delete next[channel]
          return next
        })
        await reload()
      } catch (err) {
        setError(friendlyError(err instanceof Error ? err.message : 'Failed to save'))
      } finally {
        setPendingChannel(null)
      }
    })()
  }

  return (
    <>
      <div className="studio-publish-chrome" aria-label="Posting">
        {postedChannels.map((channel) => {
          const record = byChannel.get(channel)
          const href = record?.externalUrl
          const label = `Posted on ${channelLabel(channel)}`
          if (href) {
            return (
              <a
                key={channel}
                className="studio-publish-posted"
                href={href}
                target="_blank"
                rel="noreferrer"
                title={label}
                aria-label={label}
              >
                {channelIcon(channel)}
                <span className="studio-publish-posted-check" aria-hidden>
                  ✓
                </span>
              </a>
            )
          }
          return (
            <span key={channel} className="studio-publish-posted" title={label} aria-label={label}>
              {channelIcon(channel)}
              <span className="studio-publish-posted-check" aria-hidden>
                ✓
              </span>
            </span>
          )
        })}
        <button
          type="button"
          className="studio-publish-open"
          onClick={() => setOpen(true)}
          title={postedChannels.length > 0 ? 'Post to more channels' : 'Post this video'}
        >
          <IconShare />
          <span>{postedChannels.length > 0 ? 'Post more' : 'Post'}</span>
        </button>
      </div>

      {open ? (
        <div
          className="dialog-root publish-modal-root"
          role="dialog"
          aria-modal="true"
          aria-label="Post this video"
        >
          <button
            type="button"
            className="dialog-backdrop"
            onClick={() => setOpen(false)}
            aria-label="Close"
          />
          <div className="dialog-panel publish-modal-panel">
            <header className="publish-modal-header">
              <div>
                <p className="eyebrow">Approved</p>
                <h3 className="dialog-title">Post this video</h3>
                <p className="dialog-body">
                  Download once, pick channels, paste each live link.{' '}
                  {PASTE_URL_ALWAYS_AVAILABLE_HINT} Close anytime — your editor stays as it is.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="btn btn-ghost btn-sm publish-modal-close"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </header>

            {loading ? <StudioSpinner size="sm" label="Loading" /> : null}
            {error ? <p className="error">{error}</p> : null}

            {!loading && !hasFinal ? (
              <p className="muted">Export and approve a cut before posting.</p>
            ) : null}

            {hasFinal ? (
              <ol className="publish-steps">
                <li className="publish-step">
                  <span className="publish-step-index" aria-hidden>
                    1
                  </span>
                  <div className="publish-step-body">
                    <strong>Download</strong>
                    <a
                      className="publish-download"
                      href={`/api/studio/projects/${projectId}/final/download`}
                      download
                    >
                      <IconDownload />
                      Download video
                    </a>
                  </div>
                </li>

                <li className="publish-step">
                  <span className="publish-step-index" aria-hidden>
                    2
                  </span>
                  <div className="publish-step-body">
                    <strong>Choose channels</strong>
                    <div className="publish-channel-grid" role="group" aria-label="Channels">
                      {CHANNELS.map((channel) => {
                        const record = byChannel.get(channel)
                        const posted = record ? isPosted(record.status) : false
                        const checked = selected.includes(channel) || posted
                        return (
                          <label
                            key={channel}
                            className={`publish-channel-chip${posted ? ' is-posted' : ''}${checked ? ' is-checked' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={posted || pendingChannel !== null}
                              onChange={() => toggleChannel(channel)}
                            />
                            <span className="publish-channel-icon" aria-hidden>
                              {channelIcon(channel)}
                            </span>
                            <span>{channelLabel(channel)}</span>
                            {posted ? <span className="publish-channel-done">Posted</span> : null}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </li>

                <li className="publish-step">
                  <span className="publish-step-index" aria-hidden>
                    3
                  </span>
                  <div className="publish-step-body">
                    <strong>Save each link</strong>
                    {openForLinks.length === 0 && postedChannels.length === 0 ? (
                      <p className="muted publish-step-hint">Select at least one channel above.</p>
                    ) : null}
                    {openForLinks.length === 0 && postedChannels.length > 0 ? (
                      <p className="muted publish-step-hint">
                        All selected channels are posted. Check another channel to post there too.
                      </p>
                    ) : null}
                    {openForLinks.length > 0 ? (
                      <ul className="publish-link-list">
                        {openForLinks.map((channel) => (
                          <li key={channel} className="publish-link-item">
                            <span className="publish-link-channel">
                              <span className="publish-channel-icon" aria-hidden>
                                {channelIcon(channel)}
                              </span>
                              {channelLabel(channel)}
                            </span>
                            <PastePostedUrl
                              value={urlDrafts[channel] ?? ''}
                              disabled={pendingChannel !== null}
                              onChange={(value) =>
                                setUrlDrafts((prev) => ({ ...prev, [channel]: value }))
                              }
                              onSave={() => onMarkPosted(channel)}
                              saveLabel={pendingChannel === channel ? 'Saving…' : 'Mark as posted'}
                              inputLabel={`${channelLabel(channel)} post link`}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {postedChannels.length > 0 ? (
                      <ul className="publish-done-list">
                        {postedChannels.map((channel) => {
                          const record = byChannel.get(channel)
                          return (
                            <li key={channel}>
                              <span className="publish-channel-icon" aria-hidden>
                                {channelIcon(channel)}
                              </span>
                              <span>Posted on {channelLabel(channel)}</span>
                              {record?.externalUrl ? (
                                <>
                                  {' — '}
                                  <a href={record.externalUrl} target="_blank" rel="noreferrer">
                                    view post
                                  </a>
                                </>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                </li>
              </ol>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
