import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueJobWebhooksAfterMark, generationWebhookEvent } from '../webhooks/enqueue'

export type GenerationRole =
  | 'image'
  | 'video'
  | 'speech'
  | 'transcribe'
  | 'extract'
  | 'index'
  | 'music'
  | 'voice_clone'
  | 'voice_synth'
  | 'voice_dub'
  | 'voice_lipsync'
  | 'speech_enhance'
  | 'reframe'

export type GenerationJobRow = {
  id: string
  product_id: string
  project_id: string | null
  status: 'queued' | 'generating' | 'ready' | 'failed'
  role: GenerationRole
  model_id: string | null
  model_profile_id: string | null
  estimated_gbp: number | null
  actual_gbp: number | null
  input_snapshot: Record<string, unknown>
  output_asset_id: string | null
  error_message: string | null
  attempt_count?: number
  units?: number | null
  created_at?: string
  updated_at?: string
}

export const enqueueGenerationJob = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    projectId: string | null
    role: GenerationRole
    modelId: string
    modelProfileId: string
    estimatedGbp: number
    units?: number
    inputSnapshot: Record<string, unknown>
  },
): Promise<GenerationJobRow> => {
  const id = randomUUID()
  const row = {
    id,
    product_id: input.productId,
    project_id: input.projectId,
    status: 'queued' as const,
    role: input.role,
    model_id: input.modelId,
    model_profile_id: input.modelProfileId,
    estimated_gbp: input.estimatedGbp,
    actual_gbp: null,
    input_snapshot: input.inputSnapshot,
    output_asset_id: null,
    error_message: null,
    attempt_count: 0,
    units: input.units ?? null,
  }
  const { data, error } = await supabase.from('generation_jobs').insert(row).select('*').single()
  if (error) {
    throw new Error(`Failed to enqueue generation job: ${error.message}`)
  }
  return data as GenerationJobRow
}

export const markGenerationJob = async (
  supabase: SupabaseClient,
  jobId: string,
  patch: Partial<{
    status: GenerationJobRow['status']
    output_asset_id: string | null
    actual_gbp: number | null
    error_message: string | null
    attempt_count: number
    brand_refs_unsupported: boolean
  }>,
): Promise<GenerationJobRow> => {
  const { data, error } = await supabase
    .from('generation_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select('*')
    .single()
  if (error) {
    throw new Error(`Failed to update generation job: ${error.message}`)
  }
  const row = data as GenerationJobRow
  await enqueueJobWebhooksAfterMark({
    supabase,
    productId: row.product_id,
    jobId: row.id,
    jobKind: 'generation',
    event: generationWebhookEvent(patch.status),
  })
  return row
}

export const getGenerationJob = async (
  supabase: SupabaseClient,
  jobId: string,
): Promise<GenerationJobRow | null> => {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load generation job: ${error.message}`)
  }
  return (data as GenerationJobRow | null) ?? null
}

export const listGenerationJobsForProject = async (
  supabase: SupabaseClient,
  input: {
    projectId: string
    statuses?: GenerationJobRow['status'][]
    limit?: number
  },
): Promise<GenerationJobRow[]> => {
  let query = supabase
    .from('generation_jobs')
    .select('*')
    .eq('project_id', input.projectId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 40)
  if (input.statuses && input.statuses.length > 0) {
    query = query.in('status', input.statuses)
  }
  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list generation jobs: ${error.message}`)
  }
  return (data ?? []) as GenerationJobRow[]
}

export const listGenerationJobsForProduct = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    limit?: number
  },
): Promise<GenerationJobRow[]> => {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('product_id', input.productId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 80)
  if (error) {
    throw new Error(`Failed to list generation jobs: ${error.message}`)
  }
  return (data ?? []) as GenerationJobRow[]
}
