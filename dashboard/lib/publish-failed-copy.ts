import type { PublishRecord } from '@synawood/channels'
import { channelLabel } from './channel-label'

export const failedPublishCause = (record: PublishRecord): string => {
  const failed = [...record.statusHistory].reverse().find((event) => event.status === 'failed')
  const note = failed?.note?.trim()
  if (note) return note
  return `Postiz could not publish this ${channelLabel(record.channel)} post.`
}

export const failedPublishHeadline = (record: PublishRecord): string =>
  `Post to ${channelLabel(record.channel)} failed.`

export const failedPublishPageBanner = (failed: PublishRecord[]): string => {
  const first = failed[0]
  if (!first) return ''
  if (failed.length === 1) return failedPublishHeadline(first)
  const labels = [...new Set(failed.map((record) => channelLabel(record.channel)))]
  return `${failed.length} posts failed on ${labels.join(', ')}. Fix them on the cards below.`
}
