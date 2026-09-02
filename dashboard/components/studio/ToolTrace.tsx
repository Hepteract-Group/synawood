'use client'

import { useEffect, useState } from 'react'

export type TraceEntry = {
  id: string
  toolName: string
  input: Record<string, unknown>
  outcome: { ok: boolean; summary?: string; error?: string }
  at: string
}

const formatToolName = (toolName: string): string => {
  const spaced = toolName.replaceAll('_', ' ').trim()
  if (!spaced) return toolName
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const formatTime = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const inputPreview = (input: Record<string, unknown>): string | null => {
  const entries = Object.entries(input).filter(
    ([, value]) => typeof value === 'string' || typeof value === 'number',
  )
  if (entries.length === 0) return null
  const [key, value] = entries[0]
  const text = String(value)
  return `${key}: ${text.length > 64 ? `${text.slice(0, 64)}…` : text}`
}

const TraceRow = ({ entry }: { entry: TraceEntry }) => {
  const ok = entry.outcome.ok
  const preview = inputPreview(entry.input)
  return (
    <li className={`trace-row ${ok ? 'is-ok' : 'is-bad'}`}>
      <span className="trace-status" aria-hidden />
      <div className="trace-main">
        <div className="trace-head">
          <span className="trace-name">{formatToolName(entry.toolName)}</span>
          {!ok ? (
            <span className="trace-fail-label" aria-label="failed">
              failed
            </span>
          ) : null}
          <time className="trace-time muted" dateTime={entry.at}>
            {formatTime(entry.at)}
          </time>
        </div>
        {preview ? <p className="trace-input muted mono">{preview}</p> : null}
        <p
          className={`trace-outcome ${ok && entry.outcome.summary?.includes('\n') ? 'is-multiline' : ''}`}
        >
          {ok ? entry.outcome.summary : entry.outcome.error}
        </p>
      </div>
    </li>
  )
}

export const ToolTrace = ({
  entries,
  /** Force open when parent knows failures just landed. */
  forceOpen,
}: {
  entries: TraceEntry[]
  forceOpen?: boolean
}) => {
  const failed = entries.filter((entry) => !entry.outcome.ok).length
  const shouldOpen = forceOpen === true || failed > 0
  const [open, setOpen] = useState(shouldOpen)
  const last = entries.at(-1)

  useEffect(() => {
    if (shouldOpen) setOpen(true)
  }, [shouldOpen, failed, entries.length])

  // Failures first so loud rows are not buried under successes
  const ordered = entries.slice().sort((a, b) => {
    const aBad = a.outcome.ok ? 1 : 0
    const bBad = b.outcome.ok ? 1 : 0
    if (aBad !== bBad) return aBad - bBad
    return b.at.localeCompare(a.at)
  })

  return (
    <details
      className={`tool-trace${failed > 0 ? ' has-failures' : ''}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="tool-trace-title">
          <strong>Tool trace</strong>
          {failed > 0 ? <span className="tool-trace-badge">{failed} failed</span> : null}
        </span>
        <span className="muted">
          {entries.length === 0
            ? 'no calls yet'
            : `${entries.length} call${entries.length === 1 ? '' : 's'} · last ${formatTime(last?.at ?? '')}`}
        </span>
      </summary>
      {entries.length === 0 ? (
        <p className="muted tool-trace-empty">Tool calls from this session appear here.</p>
      ) : (
        <ul className="trace-list">
          {ordered.map((entry) => (
            <TraceRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </details>
  )
}
