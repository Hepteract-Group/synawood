'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { PublishRecord } from '@synawood/channels'
import {
  boardStatusLabel,
  priorityLabel,
  type PmColumn,
  type SlotComment,
  type SlotPriority,
  type WeekBoardSlot,
} from '@/lib/content-week-board-shared'
import { PASTE_URL_ALWAYS_AVAILABLE_HINT } from '@/lib/paste-posted-copy'
import { channelLabel, PastePostedUrl } from '@/components/content/PastePostedUrl'
import { StudioSpinner } from '@/components/studio/StudioSpinner'
import { ThumbnailPicker } from '@/components/studio/ThumbnailPicker'
import { WorkSlotPublishActions } from '@/components/content/WorkSlotPublishActions'

const CHANNELS = ['linkedin_founder', 'x_founder', 'blog_seo', 'tiktok_organic'] as const

type WorkSlotDetailModalProps = {
  slotId: string
  productId: string
  open: boolean
  focusPaste?: boolean
  onClose: () => void
  onChanged: () => void
  onOpenStudio: (slot: WeekBoardSlot) => void
  onSchedule?: (slot: WeekBoardSlot) => void
  onPostNow?: (slot: WeekBoardSlot) => void
  onCancelPublish?: (slot: WeekBoardSlot) => void
}

export const WorkSlotDetailModal = ({
  slotId,
  productId,
  open,
  focusPaste = false,
  onClose,
  onChanged,
  onOpenStudio,
  onSchedule,
  onPostNow,
  onCancelPublish,
}: WorkSlotDetailModalProps) => {
  const [slot, setSlot] = useState<WeekBoardSlot | null>(null)
  const [comments, setComments] = useState<SlotComment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [labelDraft, setLabelDraft] = useState('')
  const [postedUrlDraft, setPostedUrlDraft] = useState('')
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const pasteRef = useRef<HTMLDivElement | null>(null)

  const reload = async () => {
    setError(null)
    try {
      const response = await fetch(`/api/content/slots/${slotId}`)
      const body = (await response.json()) as {
        slot?: WeekBoardSlot
        comments?: SlotComment[]
        error?: string
      }
      if (!response.ok || !body.slot) throw new Error(body.error ?? 'Failed to load task')
      setSlot(body.slot)
      setComments(body.comments ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task')
    }
  }

  useEffect(() => {
    if (!open) return
    void reload()
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, slotId])

  useEffect(() => {
    if (!open || !focusPaste) return
    pasteRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open, focusPaste, slot])

  if (!open) return null

  const savePatch = async (patch: Record<string, unknown>): Promise<boolean> => {
    if (!slot) return false
    setPending(true)
    setError(null)
    setStatusNote('Saving…')
    try {
      const response = await fetch(`/api/content/slots/${slot.slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const body = (await response.json()) as { slot?: WeekBoardSlot; error?: string }
      if (!response.ok || !body.slot) throw new Error(body.error ?? 'Failed to save')
      setSlot(body.slot)
      setStatusNote('Saved')
      onChanged()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setStatusNote(null)
      return false
    } finally {
      setPending(false)
    }
  }

  const onAddComment = () => {
    const body = commentDraft.trim()
    if (!body || !slot) return
    setPending(true)
    setError(null)
    setStatusNote('Posting comment…')
    void (async () => {
      try {
        const response = await fetch(`/api/content/slots/${slot.slotId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        })
        const payload = (await response.json()) as { comment?: SlotComment; error?: string }
        if (!response.ok || !payload.comment) throw new Error(payload.error ?? 'Failed to comment')
        setComments((prev) => [...prev, payload.comment!])
        setCommentDraft('')
        setStatusNote('Comment added')
        onChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to comment')
        setStatusNote(null)
      } finally {
        setPending(false)
      }
    })()
  }

  const onSavePostedUrl = () => {
    const postedUrl = postedUrlDraft.trim()
    if (!postedUrl || !slot) return
    if (!slot.projectId) {
      setError('Start a Studio cut and Approve a Final before pasting a post link.')
      return
    }
    if (!slot.hasFinal) {
      setError('Export and Approve a Final before pasting a post link.')
      return
    }
    setPending(true)
    setError(null)
    setStatusNote('Saving post link…')
    void (async () => {
      try {
        const prepare = await fetch('/api/studio/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            projectId: slot.projectId,
            channel: slot.channel,
            contentSlotId: slot.slotId,
          }),
        })
        const prepared = (await prepare.json()) as { record?: PublishRecord; error?: string }
        if (!prepare.ok || !prepared.record) {
          throw new Error(prepared.error ?? 'Failed to prepare publish')
        }
        const response = await fetch(`/api/studio/publish/${prepared.record.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postedUrl }),
        })
        const body = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Failed to save post link')

        const move = await fetch(`/api/content/slots/${slot.slotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardColumn: 'done' }),
        })
        if (!move.ok) {
          const moveBody = (await move.json()) as { error?: string }
          throw new Error(moveBody.error ?? 'Link saved, but could not move to Done')
        }

        setPostedUrlDraft('')
        setStatusNote('Posted — moved to Done')
        await reload()
        onChanged()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save post link')
        setStatusNote(null)
      } finally {
        setPending(false)
      }
    })()
  }

  const onDelete = () => {
    if (!slot) return
    if (!window.confirm(`Delete “${slot.title}”? This cannot be undone.`)) return
    setPending(true)
    setStatusNote('Deleting…')
    void (async () => {
      try {
        const response = await fetch(`/api/content/slots/${slot.slotId}`, { method: 'DELETE' })
        if (!response.ok) {
          const body = (await response.json()) as { error?: string }
          throw new Error(body.error ?? 'Failed to delete')
        }
        onChanged()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete')
        setStatusNote(null)
        setPending(false)
      }
    })()
  }

  return (
    <div
      className="dialog-root work-detail-root"
      role="dialog"
      aria-modal="true"
      aria-label="Task details"
    >
      <button type="button" className="dialog-backdrop" onClick={onClose} aria-label="Close" />
      <div className="dialog-panel work-detail-panel">
        <header className="work-detail-header">
          <div>
            <p className="eyebrow">Task</p>
            {slot ? (
              <input
                className="work-detail-title"
                value={slot.title}
                disabled={pending}
                onChange={(event) => setSlot({ ...slot, title: event.target.value })}
                onBlur={() => void savePatch({ title: slot.title })}
              />
            ) : (
              <StudioSpinner size="sm" label="Loading" />
            )}
          </div>
          <button ref={closeRef} type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>

        {statusNote ? (
          <p className="work-status-banner" role="status" aria-live="polite">
            {statusNote}
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}

        {slot ? (
          <>
            <div className="work-detail-grid">
              <label>
                <span>Status</span>
                <select
                  value={slot.pmColumn}
                  disabled={pending}
                  onChange={(event) => {
                    const boardColumn = event.target.value as PmColumn
                    const previous = slot.pmColumn
                    setSlot({ ...slot, pmColumn: boardColumn })
                    void (async () => {
                      const ok = await savePatch({ boardColumn })
                      if (!ok) {
                        setSlot((current) =>
                          current ? { ...current, pmColumn: previous } : current,
                        )
                      }
                    })()
                  }}
                >
                  <option value="planned">Planned</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select
                  value={slot.priority ?? ''}
                  disabled={pending}
                  onChange={(event) => {
                    const priority = (event.target.value || null) as SlotPriority | null
                    setSlot({ ...slot, priority })
                    void savePatch({ priority })
                  }}
                >
                  <option value="">None</option>
                  <option value="p0">P0</option>
                  <option value="p1">P1</option>
                  <option value="p2">P2</option>
                </select>
              </label>
              <label>
                <span>Channel</span>
                <select
                  value={slot.channel}
                  disabled={pending}
                  onChange={(event) => {
                    const channel = event.target.value
                    setSlot({ ...slot, channel })
                    void savePatch({ channel })
                  }}
                >
                  {CHANNELS.map((id) => (
                    <option key={id} value={id}>
                      {channelLabel(id)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Assignee</span>
                <input
                  value={slot.assignee ?? ''}
                  disabled={pending}
                  placeholder="Name"
                  onChange={(event) => setSlot({ ...slot, assignee: event.target.value || null })}
                  onBlur={() => void savePatch({ assignee: slot.assignee })}
                />
              </label>
              <label>
                <span>Due date</span>
                <input
                  type="date"
                  value={slot.dueDate ?? ''}
                  disabled={pending}
                  onChange={(event) => {
                    const dueDate = event.target.value || null
                    setSlot({ ...slot, dueDate })
                    void savePatch({ dueDate })
                  }}
                />
              </label>
              <label>
                <span>Planned date</span>
                <input
                  type="date"
                  value={slot.plannedDate ?? ''}
                  disabled={pending}
                  onChange={(event) => {
                    const plannedDate = event.target.value || null
                    setSlot({ ...slot, plannedDate })
                    void savePatch({ plannedDate })
                  }}
                />
              </label>
            </div>

            <label className="work-detail-block">
              <span>Notes</span>
              <textarea
                rows={3}
                value={slot.description ?? ''}
                disabled={pending}
                onChange={(event) => setSlot({ ...slot, description: event.target.value })}
                onBlur={() => void savePatch({ description: slot.description })}
              />
            </label>

            <div className="work-detail-block">
              <span>Labels</span>
              <div className="work-label-row">
                {slot.labels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="work-label-chip"
                    disabled={pending}
                    onClick={() => {
                      const labels = slot.labels.filter((item) => item !== label)
                      setSlot({ ...slot, labels })
                      void savePatch({ labels })
                    }}
                    title="Remove label"
                  >
                    {label} ×
                  </button>
                ))}
                <input
                  value={labelDraft}
                  disabled={pending}
                  placeholder="Add label"
                  onChange={(event) => setLabelDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    const next = labelDraft.trim()
                    if (!next || slot.labels.includes(next)) return
                    const labels = [...slot.labels, next]
                    setSlot({ ...slot, labels })
                    setLabelDraft('')
                    void savePatch({ labels })
                  }}
                />
              </div>
            </div>

            {slot.projectId ? (
              <div className="work-detail-block">
                <ThumbnailPicker
                  projectId={slot.projectId}
                  onChanged={async () => {
                    await reload()
                    onChanged()
                  }}
                />
              </div>
            ) : null}

            <div className="work-detail-block">
              <span>Pipeline</span>
              <p className="muted">
                {boardStatusLabel(slot.boardStatus)}
                {' · '}
                {slot.hasFinal ? 'Final ready' : 'Final missing'}
                {slot.priority ? ` · ${priorityLabel(slot.priority)}` : ''}
              </p>
              {slot.finalAssetId ? (
                <Link href={`/content/finals/${slot.finalAssetId}`} className="work-slot-action">
                  View Final snapshot
                </Link>
              ) : null}
              <button
                type="button"
                className="work-slot-action"
                disabled={pending}
                onClick={() => onOpenStudio(slot)}
              >
                {slot.studioHref ? 'Open in Studio' : 'Start cut'}
              </button>
              <WorkSlotPublishActions
                slot={slot}
                pending={pending}
                onSchedule={onSchedule}
                onPostNow={onPostNow}
                onCancelPublish={onCancelPublish}
              />
            </div>

            <div className="work-detail-block" ref={pasteRef}>
              <span>Posted links</span>
              <p className="muted" role="status">
                {PASTE_URL_ALWAYS_AVAILABLE_HINT}
              </p>
              {slot.postedLinks.length === 0 ? (
                <p className="muted">After you post live, paste the URL here to mark this Done.</p>
              ) : (
                <ul className="work-posted-list">
                  {slot.postedLinks.map((link) => (
                    <li key={link.id}>
                      <span>{channelLabel(link.channel)}</span>
                      <a href={link.url} target="_blank" rel="noreferrer">
                        {link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <PastePostedUrl
                value={postedUrlDraft}
                disabled={pending}
                onChange={setPostedUrlDraft}
                onSave={onSavePostedUrl}
                saveLabel={
                  pending && statusNote === 'Saving post link…' ? 'Saving…' : 'Mark as posted'
                }
                inputLabel="Live post URL"
              />
            </div>

            <div className="work-detail-block">
              <span>Comments</span>
              <ul className="work-comment-list">
                {comments.length === 0 ? <li className="muted">No comments yet.</li> : null}
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <strong>{comment.author}</strong>
                    <time dateTime={comment.createdAt}>
                      {new Date(comment.createdAt).toLocaleString()}
                    </time>
                    <p>{comment.body}</p>
                  </li>
                ))}
              </ul>
              <div className="work-comment-compose">
                <textarea
                  rows={2}
                  value={commentDraft}
                  disabled={pending}
                  placeholder="Leave a comment…"
                  onChange={(event) => setCommentDraft(event.target.value)}
                />
                <button
                  type="button"
                  disabled={pending || !commentDraft.trim()}
                  onClick={onAddComment}
                >
                  Add comment
                </button>
              </div>
            </div>

            <div className="work-detail-footer">
              <button
                type="button"
                className="btn btn-danger"
                disabled={pending}
                onClick={onDelete}
              >
                Delete task
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
