import type { SupabaseClient } from '@supabase/supabase-js'
import { brollPlanSchema, type BrollPlan } from './schema'

export type BrollPlanRowRecord = {
  id: string
  product_id: string
  project_id: string
  status: string
  project_revision: number
  input_hash: string
  plan_json: unknown
  created_at: string
  updated_at: string
}

export const loadBrollPlan = async (
  supabase: SupabaseClient,
  planId: string,
): Promise<{ row: BrollPlanRowRecord; plan: BrollPlan } | null> => {
  const { data, error } = await supabase
    .from('broll_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as BrollPlanRowRecord
  return { row, plan: brollPlanSchema.parse(row.plan_json) }
}

/** Latest draft or stale plan for a project (reload / banner UX). */
export const loadLatestDraftBrollPlan = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ row: BrollPlanRowRecord; plan: BrollPlan } | null> => {
  const { data, error } = await supabase
    .from('broll_plans')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['draft', 'stale'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as BrollPlanRowRecord
  return { row, plan: brollPlanSchema.parse(row.plan_json) }
}

export const findDraftBrollPlanByHash = async (
  supabase: SupabaseClient,
  input: { projectId: string; projectRevision: number; inputHash: string },
): Promise<{ row: BrollPlanRowRecord; plan: BrollPlan } | null> => {
  const { data, error } = await supabase
    .from('broll_plans')
    .select('*')
    .eq('project_id', input.projectId)
    .eq('project_revision', input.projectRevision)
    .eq('input_hash', input.inputHash)
    .eq('status', 'draft')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as BrollPlanRowRecord
  return { row, plan: brollPlanSchema.parse(row.plan_json) }
}

export const saveBrollPlan = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    projectId: string
    inputHash: string
    plan: BrollPlan
  },
): Promise<{ row: BrollPlanRowRecord; plan: BrollPlan }> => {
  const now = new Date().toISOString()
  const row = {
    id: input.plan.id,
    product_id: input.productId,
    project_id: input.projectId,
    status: input.plan.status,
    project_revision: input.plan.projectRevision,
    input_hash: input.inputHash,
    plan_json: input.plan,
    created_at: input.plan.createdAt,
    updated_at: now,
  }
  const { data, error } = await supabase.from('broll_plans').upsert(row).select('*').single()
  if (error) throw new Error(error.message)
  const saved = data as BrollPlanRowRecord
  return { row: saved, plan: brollPlanSchema.parse(saved.plan_json) }
}

export const updateBrollPlanStatus = async (
  supabase: SupabaseClient,
  input: { planId: string; plan: BrollPlan },
): Promise<BrollPlan> => {
  const { data, error } = await supabase
    .from('broll_plans')
    .update({
      status: input.plan.status,
      plan_json: input.plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.planId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return brollPlanSchema.parse((data as BrollPlanRowRecord).plan_json)
}
