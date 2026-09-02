import { channelLabel } from './channel-label'

export const POSTIZ_NOT_CONFIGURED_TITLE = 'Postiz is not configured'
export const POSTIZ_NOT_CONFIGURED_BODY =
  'Open Settings to bind a Postiz account, or paste the live URL on this card.'

export const CHANNEL_UNBOUND_TITLE = 'This channel has no Postiz account'
export const CHANNEL_UNBOUND_BODY =
  'Open Settings to bind a Postiz account, or paste the live URL on this card.'

export const POSTIZ_DOWN_TITLE = 'Postiz is down'
export const POSTIZ_DOWN_BODY = 'Paste the live URL on this card, or try Schedule again.'

export type ScheduleEmptyKind = 'not_configured' | 'unbound' | 'down'

export type ScheduleEmptyCopy = {
  title: string
  body: string
  settingsHref: string | null
}

const SETTINGS_CHANNELS = '/settings/channels'

const EMPTY_COPY: Record<ScheduleEmptyKind, ScheduleEmptyCopy> = {
  not_configured: {
    title: POSTIZ_NOT_CONFIGURED_TITLE,
    body: POSTIZ_NOT_CONFIGURED_BODY,
    settingsHref: SETTINGS_CHANNELS,
  },
  unbound: {
    title: CHANNEL_UNBOUND_TITLE,
    body: CHANNEL_UNBOUND_BODY,
    settingsHref: SETTINGS_CHANNELS,
  },
  down: { title: POSTIZ_DOWN_TITLE, body: POSTIZ_DOWN_BODY, settingsHref: null },
}

export const emptyScheduleCopy = (kind: ScheduleEmptyKind): ScheduleEmptyCopy => EMPTY_COPY[kind]

const postizUpstreamStatus = (message: string): number | null => {
  const match = message.match(
    /(?:create-post failed|list-posts failed|multipart upload failed) \((\d+)\)/i,
  )
  if (!match) return null
  const code = Number(match[1])
  return Number.isFinite(code) ? code : null
}

export const classifyScheduleError = (
  status: number,
  message: string,
): ScheduleEmptyKind | 'other' => {
  if (status === 503) return 'not_configured'
  if (/not bound|no Postiz account/i.test(message)) return 'unbound'
  const upstream = postizUpstreamStatus(message)
  if (upstream !== null) return upstream >= 500 ? 'down' : 'other'
  if (/ECONNREFUSED|ENOTFOUND|Failed to fetch|fetch failed|Load failed/i.test(message)) {
    return 'down'
  }
  return 'other'
}

export type ScheduleFailureUi =
  { phase: 'empty'; emptyKind: ScheduleEmptyKind; error: null } | { phase: 'error'; error: string }

export const scheduleFailureUi = (status: number, message: string): ScheduleFailureUi => {
  const kind = classifyScheduleError(status, message)
  if (kind !== 'other') return { phase: 'empty', emptyKind: kind, error: null }
  return { phase: 'error', error: message }
}

export const scheduleWhenLabel = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const stamp = date.toISOString().slice(0, 16).replace('T', ' ')
  return `${stamp} UTC`
}

export const schedulingBanner = (channel: string): string =>
  `Scheduling to ${channelLabel(channel)}…`

export const scheduledBanner = (channel: string, scheduledAt: string | null): string => {
  const label = channelLabel(channel)
  if (!scheduledAt) return `Scheduled to ${label}. Waiting for the live link.`
  return `Scheduled to ${label} for ${scheduleWhenLabel(scheduledAt)}. Waiting for the live link.`
}

export const postingNowBanner = (channel: string): string =>
  `Posting to ${channelLabel(channel)} now…`

export const postedNowBanner = (channel: string): string =>
  `Posted to ${channelLabel(channel)}. The live link will appear on this card.`
