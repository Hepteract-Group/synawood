'use client'

import Link from 'next/link'
import type { WeekBoardSlot } from '@/lib/content-week-board-shared'
import { channelLabel } from '@/lib/channel-label'
import {
  emptyScheduleCopy,
  postingNowBanner,
  schedulingBanner,
  type ScheduleEmptyKind,
} from '@/lib/schedule-publish-copy'
import { StudioSpinner } from '@/components/studio/StudioSpinner'

export type SchedulePhase = 'compose' | 'inflight' | 'done' | 'empty' | 'error'

type SchedulePublishModalProps = {
  slot: WeekBoardSlot
  mode: 'schedule' | 'now'
  phase: SchedulePhase
  when: string
  error: string | null
  resultNote: string | null
  emptyKind: ScheduleEmptyKind
  onWhenChange: (value: string) => void
  onConfirm: () => void
  onMinimize: () => void
  onDismiss: () => void
}

export const SchedulePublishModal = ({
  slot,
  mode,
  phase,
  when,
  error,
  resultNote,
  emptyKind,
  onWhenChange,
  onConfirm,
  onMinimize,
  onDismiss,
}: SchedulePublishModalProps) => {
  const channel = channelLabel(slot.channel)
  const empty = emptyScheduleCopy(emptyKind)
  const inflight = phase === 'inflight'
  const title =
    phase === 'empty'
      ? empty.title
      : inflight
        ? mode === 'now'
          ? postingNowBanner(slot.channel)
          : schedulingBanner(slot.channel)
        : phase === 'done'
          ? (resultNote ?? `Done — ${channel}`)
          : phase === 'error'
            ? `Could not schedule ${channel}`
            : mode === 'now'
              ? `Post to ${channel} now`
              : `Schedule ${channel}`

  return (
    <div className="dialog-root publish-modal-root" role="dialog" aria-modal="true">
      <button
        type="button"
        className="dialog-backdrop"
        onClick={inflight ? onMinimize : onDismiss}
        aria-label={inflight ? 'Minimize' : 'Close'}
      />
      <div className="dialog-panel publish-modal-panel">
        {inflight ? <StudioSpinner size="lg" /> : null}
        <h3 className="dialog-title">{title}</h3>
        {phase === 'compose' && mode === 'schedule' ? (
          <label className="work-schedule-when">
            <span>When</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(event) => onWhenChange(event.target.value)}
            />
          </label>
        ) : null}
        {phase === 'empty' ? (
          <p className="dialog-body">
            {empty.body}
            {empty.settingsHref ? (
              <>
                {' '}
                <Link href={empty.settingsHref}>Open Settings</Link>
              </>
            ) : null}
          </p>
        ) : (
          <p className="dialog-body">
            {inflight
              ? 'You can minimize this. The banner stays until Postiz answers, and it comes back if you reload after the row is saved.'
              : phase === 'done'
                ? (resultNote ?? 'Reload this page if the card has not updated yet.')
                : phase === 'error'
                  ? 'Fix the issue below, or paste the live URL on the card.'
                  : 'Approve already kept the Final. This step talks to Postiz. Paste a live URL instead if you posted by hand.'}
          </p>
        )}
        {error && phase !== 'empty' ? <p className="error">{error}</p> : null}
        <div className="dialog-actions">
          {phase === 'compose' ? (
            <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={!when}>
              Schedule
            </button>
          ) : null}
          {inflight ? (
            <button type="button" className="btn btn-ghost" onClick={onMinimize}>
              Minimize
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={onDismiss}>
              {phase === 'empty' || phase === 'error' ? 'Paste URL instead' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
