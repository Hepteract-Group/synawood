import type { SupabaseClient } from '@supabase/supabase-js'
import {
  publishChannelSchema,
  publishStatusSchema,
  isLivePostedStatus,
  type PublishAdapter,
  type PublishRecord,
  type PublishStatus,
  type PublishStatusEvent,
  type SchedulePostInput,
  type ScheduleResult,
  type StatusResult,
} from './publish-port'

type PublishRecordRow = {
  id: string
  product_id: string
  final_asset_id: string
  content_slot_id: string | null
  channel: string
  status: string
  caption: string | null
  scheduled_at: string | null
  posted_at: string | null
  external_url: string | null
  postiz_id: string | null
  status_history: unknown
  created_at: string
  updated_at: string
}

const parseHistory = (raw: unknown): PublishStatusEvent[] => {
  if (!Array.isArray(raw)) return []
  const events: PublishStatusEvent[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const status = publishStatusSchema.safeParse((entry as { status?: unknown }).status)
    const at = (entry as { at?: unknown }).at
    if (!status.success || typeof at !== 'string') continue
    const note = (entry as { note?: unknown }).note
    events.push({
      status: status.data,
      at,
      ...(typeof note === 'string' && note.length > 0 ? { note } : {}),
    })
  }
  return events
}

export const rowToPublishRecord = (row: PublishRecordRow): PublishRecord => {
  const channel = publishChannelSchema.parse(row.channel)
  const status = publishStatusSchema.parse(row.status)
  return {
    id: row.id,
    productId: row.product_id,
    finalAssetId: row.final_asset_id,
    contentSlotId: row.content_slot_id,
    channel,
    status,
    caption: row.caption,
    scheduledAt: row.scheduled_at,
    postedAt: row.posted_at,
    externalUrl: row.external_url,
    postizId: row.postiz_id,
    statusHistory: parseHistory(row.status_history),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const appendHistory = (
  existing: PublishStatusEvent[],
  status: PublishStatus,
  note?: string,
): PublishStatusEvent[] => [
  ...existing,
  {
    status,
    at: new Date().toISOString(),
    ...(note ? { note } : {}),
  },
]

const loadFinalAsset = async (
  supabase: SupabaseClient,
  finalAssetId: string,
): Promise<{ id: string; product_id: string; project_id: string; primary_asset_id: string }> => {
  const { data, error } = await supabase
    .from('final_assets')
    .select('id, product_id, project_id, primary_asset_id')
    .eq('id', finalAssetId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load Final asset: ${error.message}`)
  }
  if (!data) {
    throw new Error('Final asset not found. Approve a candidate before publishing.')
  }
  return data as {
    id: string
    product_id: string
    project_id: string
    primary_asset_id: string
  }
}

export const loadPublishRecord = async (
  supabase: SupabaseClient,
  publishRecordId: string,
): Promise<PublishRecord> => {
  const { data, error } = await supabase
    .from('publish_records')
    .select('*')
    .eq('id', publishRecordId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load publish record: ${error.message}`)
  }
  if (!data) {
    throw new Error('Publish record not found.')
  }
  return rowToPublishRecord(data as PublishRecordRow)
}

export const POSTED_CANCEL_COPY =
  'This post already went live. Cancel will not unsay it. Leave the live URL on the card.'

export const markPublishSkipped = async (
  supabase: SupabaseClient,
  publishRecordId: string,
  note = 'Cancelled before it posted.',
): Promise<PublishRecord> => {
  const existing = await loadPublishRecord(supabase, publishRecordId)
  if (isLivePostedStatus(existing.status)) {
    throw new Error(POSTED_CANCEL_COPY)
  }
  if (existing.status === 'skipped') {
    return existing
  }
  const skippedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('publish_records')
    .update({
      status: 'skipped',
      status_history: appendHistory(existing.statusHistory, 'skipped', note),
      updated_at: skippedAt,
    })
    .eq('id', publishRecordId)
    .select('*')
    .single()
  if (error) {
    throw new Error(`Failed to skip publish record: ${error.message}`)
  }
  return rowToPublishRecord(data as PublishRecordRow)
}

export const listPublishRecords = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<PublishRecord[]> => {
  const { data, error } = await supabase
    .from('publish_records')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`Failed to list publish records: ${error.message}`)
  }
  return ((data as PublishRecordRow[] | null) ?? []).map(rowToPublishRecord)
}

export const listPublishRecordsForFinal = async (
  supabase: SupabaseClient,
  finalAssetId: string,
): Promise<PublishRecord[]> => {
  const { data, error } = await supabase
    .from('publish_records')
    .select('*')
    .eq('final_asset_id', finalAssetId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`Failed to list publish records: ${error.message}`)
  }
  return ((data as PublishRecordRow[] | null) ?? []).map(rowToPublishRecord)
}

export const latestFinalForProject = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<{
  id: string
  productId: string
  projectId: string
  primaryAssetId: string
} | null> => {
  const { data, error } = await supabase
    .from('final_assets')
    .select('id, product_id, project_id, primary_asset_id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load Final asset: ${error.message}`)
  }
  if (!data) return null
  const row = data as {
    id: string
    product_id: string
    project_id: string
    primary_asset_id: string
  }
  return {
    id: row.id,
    productId: row.product_id,
    projectId: row.project_id,
    primaryAssetId: row.primary_asset_id,
  }
}

/**
 * Phase 0–1 adapter: creates a `ready` publish_records row. Founder downloads
 * the Final, posts on the channel, then calls recordManualPosted with the URL.
 */
export const createManualPublishAdapter = (supabase: SupabaseClient): PublishAdapter => ({
  schedule: async (input: SchedulePostInput): Promise<ScheduleResult> => {
    const final = await loadFinalAsset(supabase, input.finalAssetId)
    if (final.product_id !== input.productId) {
      throw new Error('Final asset product does not match publish productId.')
    }

    const { data: projectRow, error: projectError } = await supabase
      .from('studio_projects')
      .select('status')
      .eq('id', final.project_id)
      .maybeSingle()
    if (projectError) {
      throw new Error(`Failed to load Studio project: ${projectError.message}`)
    }
    if ((projectRow as { status?: string } | null)?.status === 'killed') {
      throw new Error('Cannot publish a discarded (killed) candidate.')
    }

    const history = appendHistory(
      [],
      'ready',
      'Manual publish prepared — download Final and post yourself.',
    )
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('publish_records')
      .insert({
        id,
        product_id: input.productId,
        final_asset_id: input.finalAssetId,
        content_slot_id: input.contentSlotId ?? null,
        channel: input.channel,
        status: 'ready',
        caption: input.caption ?? null,
        scheduled_at: input.scheduledAt?.toISOString() ?? null,
        status_history: history,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()
    if (error) {
      throw new Error(`Failed to create publish record: ${error.message}`)
    }
    const record = rowToPublishRecord(data as PublishRecordRow)
    return {
      externalId: record.id,
      record,
      instructions: 'Download the video, post it yourself, then paste the live link back here.',
    }
  },

  getStatus: async (externalId: string): Promise<StatusResult> => {
    const record = await loadPublishRecord(supabase, externalId)
    return {
      status: record.status,
      postedUrl: record.externalUrl,
      record,
    }
  },

  cancel: async (externalId: string): Promise<StatusResult> => {
    const record = await markPublishSkipped(supabase, externalId)
    return {
      status: record.status,
      postedUrl: record.externalUrl,
      record,
    }
  },
})

/**
 * Founder pasted the live channel URL after a manual post.
 * Transitions ready|scheduled|failed → manual_posted (idempotent if already manual_posted with same URL).
 */
export const recordManualPosted = async (
  supabase: SupabaseClient,
  input: { publishRecordId: string; postedUrl: string },
): Promise<PublishRecord> => {
  const url = input.postedUrl.trim()
  if (!url) {
    throw new Error('Posted URL is required.')
  }
  if (!URL.canParse(url) || !/^https?:\/\//i.test(url)) {
    throw new Error('Posted URL must be an absolute http(s) URL.')
  }

  const existing = await loadPublishRecord(supabase, input.publishRecordId)
  if (existing.status === 'manual_posted' || existing.status === 'posted') {
    if (existing.externalUrl === url) {
      return existing
    }
    throw new Error('Publish record already has a different posted URL.')
  }
  if (existing.status === 'skipped') {
    throw new Error('Cannot mark a skipped publish record as posted.')
  }

  const history = appendHistory(
    existing.statusHistory,
    'manual_posted',
    'Founder pasted live URL after manual channel post.',
  )
  const postedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('publish_records')
    .update({
      status: 'manual_posted',
      external_url: url,
      posted_at: postedAt,
      status_history: history,
      updated_at: postedAt,
    })
    .eq('id', input.publishRecordId)
    .select('*')
    .single()
  if (error) {
    throw new Error(`Failed to record posted URL: ${error.message}`)
  }
  return rowToPublishRecord(data as PublishRecordRow)
}
