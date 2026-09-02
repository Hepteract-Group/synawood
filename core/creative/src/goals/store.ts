/** Create / list helpers for campaign goals (ADR-0040 / #298). */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createCampaignGoalInputSchema,
  mapCampaignActionRow,
  mapCampaignGoalRow,
  mapCampaignPlanRow,
  type CampaignAction,
  type CampaignGoal,
  type CampaignPlan,
  type CreateCampaignGoalInput,
} from './schema'

export const createCampaignGoal = async (
  supabase: SupabaseClient,
  raw: CreateCampaignGoalInput,
): Promise<CampaignGoal> => {
  const input = createCampaignGoalInputSchema.parse(raw)
  const { data, error } = await supabase
    .from('campaign_goals')
    .insert({
      product_id: input.productId,
      title: input.title,
      outcome: input.outcome,
      success_metric: input.successMetric,
      created_by: input.createdBy ?? null,
      status: 'active',
    })
    .select('*')
    .single()
  if (error) throw new Error(`Create campaign goal failed: ${error.message}`)
  return mapCampaignGoalRow(data)
}

export const listCampaignGoals = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<CampaignGoal[]> => {
  const { data, error } = await supabase
    .from('campaign_goals')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`List campaign goals failed: ${error.message}`)
  return (data ?? []).map((row) => mapCampaignGoalRow(row))
}

export const getCampaignGoal = async (
  supabase: SupabaseClient,
  input: { productId: string; goalId: string },
): Promise<CampaignGoal | null> => {
  const { data, error } = await supabase
    .from('campaign_goals')
    .select('*')
    .eq('id', input.goalId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (error) throw new Error(`Load campaign goal failed: ${error.message}`)
  return data ? mapCampaignGoalRow(data) : null
}

export const createCampaignPlan = async (
  supabase: SupabaseClient,
  input: {
    goalId: string
    productId: string
    title: string
    summary?: string
    status?: CampaignPlan['status']
  },
): Promise<CampaignPlan> => {
  const { data, error } = await supabase
    .from('campaign_plans')
    .insert({
      goal_id: input.goalId,
      product_id: input.productId,
      title: input.title,
      summary: input.summary ?? '',
      status: input.status ?? 'draft',
    })
    .select('*')
    .single()
  if (error) throw new Error(`Create campaign plan failed: ${error.message}`)
  return mapCampaignPlanRow(data)
}

export const listCampaignPlansForGoal = async (
  supabase: SupabaseClient,
  input: { productId: string; goalId: string },
): Promise<CampaignPlan[]> => {
  const { data, error } = await supabase
    .from('campaign_plans')
    .select('*')
    .eq('product_id', input.productId)
    .eq('goal_id', input.goalId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`List campaign plans failed: ${error.message}`)
  return (data ?? []).map((row) => mapCampaignPlanRow(row))
}

export const createCampaignAction = async (
  supabase: SupabaseClient,
  input: {
    planId: string
    goalId: string
    productId: string
    actionType: CampaignAction['actionType']
    title: string
    payload?: Record<string, unknown>
    sortOrder?: number
    requiresApproval?: boolean
    status?: CampaignAction['status']
  },
): Promise<CampaignAction> => {
  const { data, error } = await supabase
    .from('campaign_actions')
    .insert({
      plan_id: input.planId,
      goal_id: input.goalId,
      product_id: input.productId,
      action_type: input.actionType,
      title: input.title,
      payload: input.payload ?? {},
      sort_order: input.sortOrder ?? 0,
      requires_approval: input.requiresApproval ?? true,
      status: input.status ?? 'proposed',
    })
    .select('*')
    .single()
  if (error) throw new Error(`Create campaign action failed: ${error.message}`)
  return mapCampaignActionRow(data)
}

export const listCampaignActionsForPlan = async (
  supabase: SupabaseClient,
  input: { productId: string; planId: string },
): Promise<CampaignAction[]> => {
  const { data, error } = await supabase
    .from('campaign_actions')
    .select('*')
    .eq('product_id', input.productId)
    .eq('plan_id', input.planId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(`List campaign actions failed: ${error.message}`)
  return (data ?? []).map((row) => mapCampaignActionRow(row))
}
