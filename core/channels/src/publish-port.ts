import { z } from 'zod'

/** Channel ids used across products — product configs narrow the active set. */
export const publishChannelSchema = z.enum([
  'linkedin_founder',
  'x_founder',
  'blog_seo',
  'tiktok_organic',
  'email_onboarding',
  'google_search_ads',
  'meta_retargeting',
  'linkedin_ads',
  'apple_search_ads',
])

export type PublishChannel = z.infer<typeof publishChannelSchema>

export const publishStatusSchema = z.enum([
  'ready',
  'scheduled',
  'posted',
  'failed',
  'skipped',
  'manual_posted',
])

export type PublishStatus = z.infer<typeof publishStatusSchema>

export const isLivePostedStatus = (status: PublishStatus): boolean =>
  status === 'posted' || status === 'manual_posted'

export type SchedulePostInput = {
  productId: string
  finalAssetId: string
  channel: PublishChannel
  caption?: string
  contentSlotId?: string | null
  scheduledAt?: Date
}

export type PublishStatusEvent = {
  status: PublishStatus
  at: string
  note?: string
}

export type PublishRecord = {
  id: string
  productId: string
  finalAssetId: string
  contentSlotId: string | null
  channel: PublishChannel
  status: PublishStatus
  caption: string | null
  scheduledAt: string | null
  postedAt: string | null
  externalUrl: string | null
  postizId: string | null
  statusHistory: PublishStatusEvent[]
  createdAt: string
  updatedAt: string
}

export type ScheduleResult = {
  /** Adapter-scoped id — for manual this is the publish_records.id. */
  externalId: string
  record: PublishRecord
  /** Human instructions for Phase 0–1 (download + post yourself). */
  instructions: string
}

export type StatusResult = {
  status: PublishStatus
  postedUrl: string | null
  record: PublishRecord
}

/**
 * Product-agnostic publish port. Phase 0–1: manualPublishAdapter.
 * Phase 2: postizPublishAdapter. Studio talks to the port — never Postiz SDKs.
 */
export type PublishAdapter = {
  schedule: (input: SchedulePostInput) => Promise<ScheduleResult>
  getStatus: (externalId: string) => Promise<StatusResult>
  /** `externalId` is `publish_records.id` (not the Postiz post id). */
  cancel: (externalId: string) => Promise<StatusResult>
}
