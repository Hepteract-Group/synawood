'use client'

import { slotCanSchedule, type WeekBoardSlot } from '@/lib/content-week-board-shared'

type WorkSlotPublishActionsProps = {
  slot: WeekBoardSlot
  pending?: boolean
  onSchedule?: (slot: WeekBoardSlot) => void
  onPostNow?: (slot: WeekBoardSlot) => void
  onCancelPublish?: (slot: WeekBoardSlot) => void
  onPasteUrl?: (slot: WeekBoardSlot) => void
}

export const WorkSlotPublishActions = ({
  slot,
  pending,
  onSchedule,
  onPostNow,
  onCancelPublish,
  onPasteUrl,
}: WorkSlotPublishActionsProps) => {
  const canSchedule = slotCanSchedule(slot)
  const canCancel = (slot.publishes ?? []).some(
    (row) => row.status === 'failed' || row.status === 'scheduled',
  )
  const canPaste = Boolean(slot.hasFinal && onPasteUrl)
  if (!canSchedule && !canCancel && !canPaste) return null

  return (
    <>
      {canSchedule ? (
        <div
          className="work-slot-publish-actions"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="work-slot-action"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation()
              onSchedule?.(slot)
            }}
          >
            Schedule
          </button>
          <button
            type="button"
            className="work-slot-action"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation()
              onPostNow?.(slot)
            }}
          >
            Post now
          </button>
        </div>
      ) : null}
      {canPaste ? (
        <button
          type="button"
          className="work-slot-action"
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation()
            onPasteUrl?.(slot)
          }}
        >
          Paste URL
        </button>
      ) : null}
      {canCancel ? (
        <button
          type="button"
          className="work-slot-action"
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation()
            onCancelPublish?.(slot)
          }}
        >
          Cancel
        </button>
      ) : null}
    </>
  )
}
