import type { SupabaseClient } from '@supabase/supabase-js'

export type CostEventInput = {
  productId: string
  projectId?: string
  jobId?: string
  role: string
  modelId?: string
  units?: number
  estimatedGbp?: number
  actualGbp?: number
}

export const recordCostEvent = async (
  supabase: SupabaseClient,
  input: CostEventInput,
): Promise<{ id: string }> => {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('cost_events').insert({
    id,
    product_id: input.productId,
    project_id: input.projectId ?? null,
    job_id: input.jobId ?? null,
    role: input.role,
    model_id: input.modelId ?? null,
    units: input.units ?? null,
    estimated_gbp: input.estimatedGbp ?? null,
    actual_gbp: input.actualGbp ?? null,
  })
  if (error) {
    throw new Error(`Failed to record cost event: ${error.message}`)
  }
  return { id }
}

export const costEventGbp = (row: {
  actual_gbp?: number | string | null
  estimated_gbp?: number | string | null
}): number => {
  const value = Number(row.actual_gbp ?? row.estimated_gbp ?? 0)
  return Number.isFinite(value) ? value : 0
}

export const sumCostEventsGbp = async (
  supabase: SupabaseClient,
  input: { productId: string; projectId?: string; sinceIso?: string },
): Promise<number> => {
  let query = supabase
    .from('cost_events')
    .select('actual_gbp, estimated_gbp')
    .eq('product_id', input.productId)
  if (input.sinceIso) {
    query = query.gte('created_at', input.sinceIso)
  }
  if (input.projectId) {
    query = query.eq('project_id', input.projectId)
  }
  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to sum cost events: ${error.message}`)
  }
  return (data ?? []).reduce((sum, row) => sum + costEventGbp(row), 0)
}

export type CostEventRow = {
  id: string
  product_id: string
  project_id: string | null
  role: string
  model_id: string | null
  estimated_gbp: number | string | null
  actual_gbp: number | string | null
  created_at: string
}

/** Load cost events for one or more Products (newest first). */
export const listCostEventsForProducts = async (
  supabase: SupabaseClient,
  input: { productIds: string[]; sinceIso?: string; limit?: number },
): Promise<CostEventRow[]> => {
  if (input.productIds.length === 0) return []
  let query = supabase
    .from('cost_events')
    .select('id, product_id, project_id, role, model_id, estimated_gbp, actual_gbp, created_at')
    .in('product_id', input.productIds)
    .order('created_at', { ascending: false })
  if (input.sinceIso) {
    query = query.gte('created_at', input.sinceIso)
  }
  if (input.limit != null) {
    query = query.limit(input.limit)
  }
  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list cost events: ${error.message}`)
  }
  return (data ?? []) as CostEventRow[]
}

export const updateCostEventActual = async (
  supabase: SupabaseClient,
  costEventId: string,
  actualGbp: number,
): Promise<void> => {
  const { error } = await supabase
    .from('cost_events')
    .update({ actual_gbp: actualGbp })
    .eq('id', costEventId)
  if (error) {
    throw new Error(`Failed to update cost event actual: ${error.message}`)
  }
}

/** Update an existing job cost row after debit-at-enqueue; insert when billing skipped (#1039). */
export const finalizeCostEvent = async (
  supabase: SupabaseClient,
  input: CostEventInput & { actualGbp: number },
): Promise<{ id: string }> => {
  if (input.jobId) {
    const { data, error } = await supabase
      .from('cost_events')
      .select('id')
      .eq('job_id', input.jobId)
      .maybeSingle()
    if (error) {
      throw new Error(`Failed to load cost event for job: ${error.message}`)
    }
    if (data?.id) {
      await updateCostEventActual(supabase, data.id as string, input.actualGbp)
      return { id: data.id as string }
    }
  }
  return recordCostEvent(supabase, { ...input, actualGbp: input.actualGbp })
}
