/** Dispatch approved campaign actions (ADR-0040 / #302). No ad spend. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { mapCampaignActionRow, type CampaignAction } from './schema'

const appendEvent = async (
  supabase: SupabaseClient,
  input: {
    actionId: string
    eventType: string
    detail?: Record<string, unknown>
    actorUserId?: string | null
  },
) => {
  await supabase.from('campaign_action_events').insert({
    action_id: input.actionId,
    event_type: input.eventType,
    detail: input.detail ?? {},
    actor_user_id: input.actorUserId ?? null,
  })
}

const loadAction = async (
  supabase: SupabaseClient,
  input: { productId: string; actionId: string },
): Promise<CampaignAction> => {
  const { data, error } = await supabase
    .from('campaign_actions')
    .select('*')
    .eq('id', input.actionId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (error) throw new Error(`Load action failed: ${error.message}`)
  if (!data) throw new Error(`Unknown action ${input.actionId}`)
  return mapCampaignActionRow(data)
}

const assertDispatchAllowed = async (
  supabase: SupabaseClient,
  action: CampaignAction,
): Promise<void> => {
  const { data: goal, error: goalError } = await supabase
    .from('campaign_goals')
    .select('status')
    .eq('id', action.goalId)
    .maybeSingle()
  if (goalError) throw new Error(goalError.message)
  if (!goal) throw new Error('Goal missing')
  if (goal.status === 'paused' || goal.status === 'killed') {
    throw new Error(`Goal is ${goal.status}; dispatch blocked`)
  }

  const { data: plan, error: planError } = await supabase
    .from('campaign_plans')
    .select('status')
    .eq('id', action.planId)
    .maybeSingle()
  if (planError) throw new Error(planError.message)
  if (!plan) throw new Error('Plan missing')
  if (plan.status === 'paused' || plan.status === 'killed') {
    throw new Error(`Plan is ${plan.status}; dispatch blocked`)
  }
}

const runActionBody = async (action: CampaignAction): Promise<Record<string, unknown>> => {
  switch (action.actionType) {
    case 'noop_verify':
      return { verified: true, at: new Date().toISOString() }
    case 'draft_brief':
      return {
        kind: 'draft_brief',
        note: 'Open Campaigns or Studio Agent to draft the brief; payload preserved.',
        payload: action.payload,
      }
    case 'create_campaign_pack':
      return {
        kind: 'create_campaign_pack',
        href: '/campaigns',
        payload: action.payload,
      }
    case 'open_studio_project':
      return {
        kind: 'open_studio_project',
        href: '/studio',
        payload: action.payload,
      }
    case 'generate_stills':
    case 'enqueue_render':
    case 'draft_content_slot':
      return {
        kind: action.actionType,
        note: 'Dispatcher recorded intent only — run the matching Studio/Campaigns flow next.',
        payload: action.payload,
      }
    default:
      return { kind: action.actionType, payload: action.payload }
  }
}

export const dispatchCampaignAction = async (
  supabase: SupabaseClient,
  input: { productId: string; actionId: string; actorUserId?: string | null },
): Promise<CampaignAction> => {
  const action = await loadAction(supabase, input)
  if (action.status !== 'approved') {
    throw new Error(`Action status is ${action.status}; approve before dispatch`)
  }
  await assertDispatchAllowed(supabase, action)

  const startedAt = new Date().toISOString()
  const { error: runningError } = await supabase
    .from('campaign_actions')
    .update({ status: 'running', started_at: startedAt, updated_at: startedAt })
    .eq('id', action.id)
  if (runningError) throw new Error(runningError.message)
  await appendEvent(supabase, {
    actionId: action.id,
    eventType: 'dispatch_started',
    actorUserId: input.actorUserId,
  })

  try {
    const result = await runActionBody(action)
    const finishedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('campaign_actions')
      .update({
        status: 'done',
        result,
        finished_at: finishedAt,
        updated_at: finishedAt,
        error_message: null,
      })
      .eq('id', action.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    await appendEvent(supabase, {
      actionId: action.id,
      eventType: 'dispatch_done',
      detail: result,
      actorUserId: input.actorUserId,
    })
    return mapCampaignActionRow(data)
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const message = error instanceof Error ? error.message : 'Dispatch failed'
    await supabase
      .from('campaign_actions')
      .update({
        status: 'failed',
        error_message: message,
        finished_at: finishedAt,
        updated_at: finishedAt,
      })
      .eq('id', action.id)
    await appendEvent(supabase, {
      actionId: action.id,
      eventType: 'dispatch_failed',
      detail: { message },
      actorUserId: input.actorUserId,
    })
    throw error
  }
}

export const approveCampaignAction = async (
  supabase: SupabaseClient,
  input: { productId: string; actionId: string; approvedBy: string; approve: boolean },
): Promise<CampaignAction> => {
  const action = await loadAction(supabase, input)
  if (action.status !== 'awaiting_approval' && action.status !== 'proposed') {
    throw new Error(`Action status is ${action.status}; cannot approve/reject`)
  }
  const now = new Date().toISOString()
  const nextStatus = input.approve ? 'approved' : 'rejected'
  const { data, error } = await supabase
    .from('campaign_actions')
    .update({
      status: nextStatus,
      approved_at: input.approve ? now : null,
      approved_by: input.approve ? input.approvedBy : null,
      updated_at: now,
    })
    .eq('id', action.id)
    .eq('product_id', input.productId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  await appendEvent(supabase, {
    actionId: action.id,
    eventType: input.approve ? 'approved' : 'rejected',
    actorUserId: input.approvedBy,
  })
  return mapCampaignActionRow(data)
}
