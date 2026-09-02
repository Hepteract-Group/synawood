'use client'

import { resolveRegenEffectId } from '@synawood/creative/effects'
import {
  formatWhyLogTimecode,
  type ProjectClip,
  type WhyLogEntry,
} from '@synawood/creative/project/client'

type EditsPanelProps = {
  open: boolean
  entries: WhyLogEntry[]
  clips?: ReadonlyArray<Pick<ProjectClip, 'id' | 'treatments'>>
  regenBusy?: boolean
  onRegenEffect?: (clipId: string, effectId: string) => Promise<void>
  onClose: () => void
}

const actionLabel = (action: string): string => {
  if (action === 'duck') return 'Music'
  if (action === 'enhance') return 'Speech'
  if (action === 'reframe') return 'Reframe'
  if (action === 'cut') return 'Cut'
  if (action === 'effect') return 'Treatment'
  return action
}

export const EditsPanel = ({
  open,
  entries,
  clips,
  regenBusy = false,
  onRegenEffect,
  onClose,
}: EditsPanelProps) => {
  if (!open) return null

  return (
    <div className="music-panel-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="music-panel edits-panel"
        role="dialog"
        aria-labelledby="edits-panel-title"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="music-panel-header">
          <div>
            <p className="eyebrow">This cut</p>
            <h2 id="edits-panel-title">Edits</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="music-panel-lede">
          Why the cut changed. This list is a log, not the timeline itself.
        </p>
        {regenBusy ? (
          <p className="edits-panel-status" role="status" aria-live="polite">
            Regenerating this treatment…
          </p>
        ) : null}
        {entries.length === 0 ? (
          <p className="muted" role="status">
            Edits the agent or tools make will show up here. They survive reload so anyone on the
            team can read them.
          </p>
        ) : (
          <ol className="edits-panel-list">
            {entries
              .slice()
              .reverse()
              .map((entry) => {
                const clip = clips?.find((item) => item.id === entry.target)
                const effectId =
                  entry.action === 'effect'
                    ? resolveRegenEffectId(entry.reason, clip?.treatments ?? [])
                    : undefined
                return (
                  <li key={entry.id} className="edits-panel-row">
                    <p className="edits-panel-reason">{entry.reason}</p>
                    <p className="muted edits-panel-meta">
                      {actionLabel(entry.action)} · {formatWhyLogTimecode(entry.t)}
                    </p>
                    {effectId && onRegenEffect ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm edits-panel-regen"
                        disabled={regenBusy}
                        aria-busy={regenBusy}
                        onClick={() => {
                          void onRegenEffect(entry.target, effectId)
                        }}
                      >
                        Regenerate this
                      </button>
                    ) : null}
                  </li>
                )
              })}
          </ol>
        )}
      </aside>
    </div>
  )
}
