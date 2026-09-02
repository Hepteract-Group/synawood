import type { SupabaseClient } from '@supabase/supabase-js'
import { directorPlanSchema, type DirectorPlan } from '../intent/schema'

export type DirectorPlanRow = {
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

export const loadDirectorPlan = async (
  supabase: SupabaseClient,
  planId: string,
): Promise<{ row: DirectorPlanRow; plan: DirectorPlan } | null> => {
  const { data, error } = await supabase
    .from('director_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as DirectorPlanRow
  return { row, plan: directorPlanSchema.parse(row.plan_json) }
}

export const findDraftDirectorPlanByHash = async (
  supabase: SupabaseClient,
  input: { projectId: string; projectRevision: number; inputHash: string },
): Promise<{ row: DirectorPlanRow; plan: DirectorPlan } | null> => {
  const { data, error } = await supabase
    .from('director_plans')
    .select('*')
    .eq('project_id', input.projectId)
    .eq('project_revision', input.projectRevision)
    .eq('input_hash', input.inputHash)
    .eq('status', 'draft')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as DirectorPlanRow
  return { row, plan: directorPlanSchema.parse(row.plan_json) }
}

/** Latest draft or stale plan for a project (reload / pill UX). */
export const loadLatestDraftDirectorPlan = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ row: DirectorPlanRow; plan: DirectorPlan } | null> => {
  const { data, error } = await supabase
    .from('director_plans')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['draft', 'stale'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as DirectorPlanRow
  return { row, plan: directorPlanSchema.parse(row.plan_json) }
}

export const saveDirectorPlan = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    projectId: string
    inputHash: string
    plan: DirectorPlan
  },
): Promise<{ row: DirectorPlanRow; plan: DirectorPlan }> => {
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
  const { data, error } = await supabase.from('director_plans').upsert(row).select('*').single()
  if (error) throw new Error(error.message)
  const saved = data as DirectorPlanRow
  return { row: saved, plan: directorPlanSchema.parse(saved.plan_json) }
}

export const updateDirectorPlanStatus = async (
  supabase: SupabaseClient,
  input: { planId: string; plan: DirectorPlan },
): Promise<DirectorPlan> => {
  const { data, error } = await supabase
    .from('director_plans')
    .update({
      status: input.plan.status,
      plan_json: input.plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.planId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return directorPlanSchema.parse((data as DirectorPlanRow).plan_json)
}
