'use client'

export { channelLabel } from '@/lib/channel-label'

type PastePostedUrlProps = {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onSave: () => void
  saveLabel?: string
  inputLabel?: string
}

/** Shared paste-URL control for Studio publish panel and Content board. */
export const PastePostedUrl = ({
  value,
  disabled,
  onChange,
  onSave,
  saveLabel = 'Save link',
  inputLabel = 'Post link',
}: PastePostedUrlProps) => (
  <div className="publish-paste-row">
    <input
      type="url"
      placeholder="https://…"
      value={value}
      disabled={disabled}
      aria-label={inputLabel}
      onChange={(event) => onChange(event.target.value)}
    />
    <button type="button" disabled={disabled || !value.trim()} onClick={onSave}>
      {saveLabel}
    </button>
  </div>
)

export const publishStatusLabel = (status: string): string => {
  switch (status) {
    case 'ready':
    case 'scheduled':
      return 'Waiting for link'
    case 'manual_posted':
    case 'posted':
      return 'Posted'
    case 'failed':
      return 'Failed'
    case 'skipped':
      return 'Skipped'
    default:
      return 'In progress'
  }
}
