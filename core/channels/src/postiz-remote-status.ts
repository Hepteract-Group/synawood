import type { SupabaseClient } from '@supabase/supabase-js'
import { rowToPublishRecord } from './manual-publish'
import type { PublishRecord, PublishStatus, StatusResult } from './publish-port'

export type PostizListState = 'QUEUE' | 'PUBLISHED' | 'ERROR' | 'DRAFT'

const nonEmptyUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export const asPostizListState = (value: string): PostizListState | null => {
  if (value === 'QUEUE' || value === 'PUBLISHED' || value === 'ERROR' || value === 'DRAFT') {
    return value
  }
  return null
}

type PollOutcome = {
  status: PublishStatus
  postedUrl: string | null
  note: string
}

const persistPollStatus = async (
  supabase: SupabaseClient,
  existing: PublishRecord,
  next: PollOutcome,
): Promise<PublishRecord> => {
  if (existing.status === next.status && existing.externalUrl === next.postedUrl) {
    return existing
  }
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('publish_records')
    .update({
      status: next.status,
      external_url: next.postedUrl,
      posted_at: next.status === 'posted' ? (existing.postedAt ?? now) : existing.postedAt,
      status_history: [
        ...existing.statusHistory,
        { status: next.status, at: now, note: next.note },
      ],
      updated_at: now,
    })
    .eq('id', existing.id)
    .select('*')
    .single()
  if (error) throw new Error(`Failed to persist Postiz remote status: ${error.message}`)
  return rowToPublishRecord(data as never)
}

const unchanged = (record: PublishRecord): StatusResult => ({
  status: record.status,
  postedUrl: record.externalUrl,
  record,
})

export const applyPostizRemoteState = async (
  supabase: SupabaseClient,
  record: PublishRecord,
  remote: { state: string; releaseURL?: string | null },
  note: string,
): Promise<StatusResult> => {
  if (record.status === 'manual_posted' || record.status === 'skipped') {
    return unchanged(record)
  }
  const state = asPostizListState(remote.state)
  if (state === 'PUBLISHED') {
    const postedUrl = nonEmptyUrl(remote.releaseURL)
    if (!postedUrl) return unchanged(record)
    const updated = await persistPollStatus(supabase, record, {
      status: 'posted',
      postedUrl,
      note,
    })
    return { status: updated.status, postedUrl: updated.externalUrl, record: updated }
  }
  if (state === 'ERROR') {
    const updated = await persistPollStatus(supabase, record, {
      status: 'failed',
      postedUrl: record.externalUrl,
      note,
    })
    return { status: updated.status, postedUrl: updated.externalUrl, record: updated }
  }
  return unchanged(record)
}
