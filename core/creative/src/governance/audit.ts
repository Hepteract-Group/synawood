/** Approval-chain audit CSV (#321). Pure serializer + list helper. */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapApprovalEventRow,
  mapApprovalRunRow,
  type ApprovalEvent,
  type ApprovalRun,
} from './schema'

export type ApprovalAuditRow = {
  run: Pick<ApprovalRun, 'id' | 'productId' | 'projectId' | 'status' | 'policyVersion'>
  event: ApprovalEvent
}

export const csvEscapeField = (value: string): string => {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

export const AUDIT_RUN_LIMIT = 200
export const AUDIT_EVENT_LIMIT = 2000

const AUDIT_HEADER = [
  'run_id',
  'project_id',
  'run_status',
  'policy_version',
  'event_id',
  'action',
  'stage_key',
  'stage_index',
  'actor_role',
  'reason',
  'detail',
  'created_at',
] as const

const serializeEventDetail = (detail: Record<string, unknown>): string => {
  if (Object.keys(detail).length === 0) return ''
  return JSON.stringify(detail)
}

export const approvalAuditToCsv = (rows: ApprovalAuditRow[]): string => {
  const lines = [AUDIT_HEADER.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.run.id,
        row.run.projectId,
        row.run.status,
        String(row.run.policyVersion),
        row.event.id,
        row.event.action,
        row.event.stageKey,
        String(row.event.stageIndex),
        row.event.actorRole ?? '',
        row.event.reason,
        serializeEventDetail(row.event.detail),
        row.event.createdAt,
      ]
        .map(csvEscapeField)
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export const listApprovalAuditRows = async (
  supabase: SupabaseClient,
  input: { productId: string; limit?: number },
): Promise<ApprovalAuditRow[]> => {
  const runLimit = Math.max(1, Math.min(input.limit ?? AUDIT_RUN_LIMIT, 500))
  const { data: runRows, error: runError } = await supabase
    .from('approval_runs')
    .select('*')
    .eq('product_id', input.productId)
    .order('created_at', { ascending: false })
    .limit(runLimit)
  if (runError) throw new Error(`Failed to list approval runs for audit: ${runError.message}`)
  const runs = (runRows ?? []).map((row) => mapApprovalRunRow(row as Record<string, unknown>))
  if (runs.length === 0) return []

  const { data: eventRows, error: eventError } = await supabase
    .from('approval_events')
    .select('*')
    .in(
      'run_id',
      runs.map((run) => run.id),
    )
    .order('created_at', { ascending: true })
    .limit(AUDIT_EVENT_LIMIT)
  if (eventError) throw new Error(`Failed to list approval events for audit: ${eventError.message}`)

  const runById = new Map(runs.map((run) => [run.id, run]))
  const out: ApprovalAuditRow[] = []
  for (const raw of eventRows ?? []) {
    const event = mapApprovalEventRow(raw as Record<string, unknown>)
    const run = runById.get(event.runId)
    if (!run) continue
    out.push({
      run: {
        id: run.id,
        productId: run.productId,
        projectId: run.projectId,
        status: run.status,
        policyVersion: run.policyVersion,
      },
      event,
    })
  }
  return out
}
