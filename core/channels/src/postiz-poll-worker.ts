import type { SupabaseClient } from '@supabase/supabase-js'
import { rowToPublishRecord } from './manual-publish'
import type { PublishAdapter, PublishRecord, PublishStatus, StatusResult } from './publish-port'

const POLLABLE_STATUSES = new Set<PublishStatus>(['scheduled', 'posted'])

const isPollable = (row: PublishRecord): boolean => {
  if (!row.postizId) return false
  if (!POLLABLE_STATUSES.has(row.status)) return false
  if (row.status === 'posted' && row.externalUrl) return false
  return true
}

export const listPostizPollableRecords = async (
  supabase: SupabaseClient,
): Promise<PublishRecord[]> => {
  const { data, error } = await supabase
    .from('publish_records')
    .select('*')
    .not('postiz_id', 'is', null)
    .in('status', ['scheduled', 'posted'])
  if (error) throw new Error(`Failed to list Postiz poll rows: ${error.message}`)
  return ((data as Record<string, unknown>[] | null) ?? [])
    .map((row) => rowToPublishRecord(row as never))
    .filter(isPollable)
}

export const runPostizPollJob = async (input: {
  supabase: SupabaseClient
  adapter: Pick<PublishAdapter, 'getStatus'>
}): Promise<{
  polled: number
  results: StatusResult[]
  errors: Array<{ id: string }>
}> => {
  const rows = await listPostizPollableRecords(input.supabase)
  const results: StatusResult[] = []
  const errors: Array<{ id: string }> = []
  for (const row of rows) {
    try {
      results.push(await input.adapter.getStatus(row.id))
    } catch {
      errors.push({ id: row.id })
    }
  }
  return { polled: results.length, errors, results }
}
