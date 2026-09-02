/** Pause / kill goal or plan (#305). */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapCampaignGoalRow,
  mapCampaignPlanRow,
  type CampaignGoal,
  type CampaignPlan,
} from './schema'

export const setCampaignGoalLifecycle = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    goalId: string
    status: 'active' | 'paused' | 'killed' | 'completed'
  },
): Promise<CampaignGoal> => {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
  }
  if (input.status === 'paused') patch.paused_at = now
  if (input.status === 'killed') patch.killed_at = now
  if (input.status === 'completed') patch.completed_at = now
  if (input.status === 'active') {
    patch.paused_at = null
    patch.killed_at = null
  }

  const { data, error } = await supabase
    .from('campaign_goals')
    .update(patch)
    .eq('id', input.goalId)
    .eq('product_id', input.productId)
    .select('*')
    .single()
  if (error) throw new Error(`Update goal lifecycle failed: ${error.message}`)

  if (input.status === 'paused' || input.status === 'killed') {
    await supabase
      .from('campaign_plans')
      .update({
        status: input.status,
        updated_at: now,
        ...(input.status === 'paused' ? { paused_at: now } : { killed_at: now }),
      })
      .eq('goal_id', input.goalId)
      .eq('product_id', input.productId)
      .in('status', ['draft', 'active', 'paused'])

    await supabase
      .from('campaign_actions')
      .update({
        status: 'killed',
        updated_at: now,
        finished_at: now,
      })
      .eq('goal_id', input.goalId)
      .eq('product_id', input.productId)
      .in('status', ['proposed', 'awaiting_approval', 'approved', 'running'])
  }

  return mapCampaignGoalRow(data)
}

export const setCampaignPlanLifecycle = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    planId: string
    status: 'draft' | 'active' | 'paused' | 'killed' | 'completed'
  },
): Promise<CampaignPlan> => {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
  }
  if (input.status === 'paused') patch.paused_at = now
  if (input.status === 'killed') patch.killed_at = now

  const { data, error } = await supabase
    .from('campaign_plans')
    .update(patch)
    .eq('id', input.planId)
    .eq('product_id', input.productId)
    .select('*')
    .single()
  if (error) throw new Error(`Update plan lifecycle failed: ${error.message}`)

  if (input.status === 'paused' || input.status === 'killed') {
    await supabase
      .from('campaign_actions')
      .update({
        status: 'killed',
        updated_at: now,
        finished_at: now,
      })
      .eq('plan_id', input.planId)
      .eq('product_id', input.productId)
      .in('status', ['proposed', 'awaiting_approval', 'approved', 'running'])
  }

  return mapCampaignPlanRow(data)
}
