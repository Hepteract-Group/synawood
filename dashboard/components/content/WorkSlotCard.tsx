'use client'

import {
  boardStatusLabel,
  priorityLabel,
  slotShowsThumbnailPicker,
  type WeekBoardSlot,
} from '@/lib/content-week-board-shared'
import { channelLabel } from '@/components/content/PastePostedUrl'
import { channelNeedsThumbnail } from '@synawood/creative/project/client'
import { ThumbnailPicker } from '@/components/studio/ThumbnailPicker'
import { WorkSlotPublishActions } from '@/components/content/WorkSlotPublishActions'
import { scheduledBanner } from '@/lib/schedule-publish-copy'

type WorkSlotCardProps = {
  slot: WeekBoardSlot
  compact?: boolean
  draggable?: boolean
  onOpen: (slot: WeekBoardSlot) => void
  onDragStart?: (slotId: string) => void
  onChanged?: () => void
  onSchedule?: (slot: WeekBoardSlot) => void
  onPostNow?: (slot: WeekBoardSlot) => void
  onCancelPublish?: (slot: WeekBoardSlot) => void
  onPasteUrl?: (slot: WeekBoardSlot) => void
}

export const WorkSlotCard = ({
  slot,
  compact,
  draggable = false,
  onOpen,
  onDragStart,
  onChanged,
  onSchedule,
  onPostNow,
  onCancelPublish,
  onPasteUrl,
}: WorkSlotCardProps) => {
  const failed = (slot.publishes ?? []).find((row) => row.status === 'failed')
  const scheduled = (slot.publishes ?? []).find((row) => row.status === 'scheduled')

  return (
    <article
      className={`work-slot-card${compact ? ' is-compact' : ''}`}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return
        event.dataTransfer.setData('text/slot-id', slot.slotId)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart?.(slot.slotId)
      }}
    >
      <header className="work-slot-card-header">
        <span className="work-slot-channel">{channelLabel(slot.channel)}</span>
        <span className={`work-slot-pill is-${slot.boardStatus}`}>
          {boardStatusLabel(slot.boardStatus)}
        </span>
      </header>
      {slot.trialExport ? (
        <p className="work-slot-trial-export" role="status">
          Trial export
        </p>
      ) : null}
      <h3 className="work-slot-title">
        <button type="button" className="work-slot-title-btn" onClick={() => onOpen(slot)}>
          {slot.title}
        </button>
      </h3>
      <div className="work-slot-meta">
        {slot.priority ? (
          <span className={`work-priority is-${slot.priority}`}>
            {priorityLabel(slot.priority)}
          </span>
        ) : null}
        {slot.dueDate ? <span>Due {slot.dueDate}</span> : null}
        {slot.assignee ? <span>{slot.assignee}</span> : null}
        {slot.commentCount > 0 ? <span>{slot.commentCount} comments</span> : null}
      </div>
      {slot.labels.length > 0 ? (
        <div className="work-slot-labels">
          {slot.labels.map((label) => (
            <span key={label} className="work-label-chip is-static">
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {slot.postedLinks.length > 0 ? (
        <div className="work-slot-posts">
          {slot.postedLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {channelLabel(link.channel)} ↗
            </a>
          ))}
        </div>
      ) : (
        <span className="work-final is-no">
          {slot.hasFinal ? 'Final ready · no link yet' : 'Final missing'}
        </span>
      )}
      {failed ? (
        <p className="work-slot-failed-banner" role="alert">
          {`Post to ${channelLabel(failed.channel)} failed.`}
        </p>
      ) : null}
      {scheduled ? (
        <p className="work-slot-schedule-banner" role="status">
          {scheduledBanner(scheduled.channel, scheduled.scheduledAt)}
        </p>
      ) : null}
      {channelNeedsThumbnail(slot.channel) && slot.hasFinal && !slot.thumbnailAssetId ? (
        <p className="work-slot-thumb-banner" role="status">
          Pick a thumbnail before Schedule.
        </p>
      ) : null}
      {slot.projectId && slotShowsThumbnailPicker(slot) ? (
        <div
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ThumbnailPicker projectId={slot.projectId} compact onChanged={onChanged} />
        </div>
      ) : null}
      <WorkSlotPublishActions
        slot={slot}
        onSchedule={onSchedule}
        onPostNow={onPostNow}
        onCancelPublish={onCancelPublish}
        onPasteUrl={onPasteUrl}
      />
      <button type="button" className="work-slot-action" onClick={() => onOpen(slot)}>
        Open
      </button>
    </article>
  )
}
