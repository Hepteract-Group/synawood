import type { SupabaseClient } from '@supabase/supabase-js'
import type { GenerationJobRow } from './enqueue'
import type { RenderJobRow } from '../render/enqueue'

export const listQueuedExtractJobs = async (
  supabase: SupabaseClient,
  limit = 5,
): Promise<GenerationJobRow[]> => {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('role', 'extract')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) {
    throw new Error(`Failed to list queued extract jobs: ${error.message}`)
  }
  return (data ?? []) as GenerationJobRow[]
}

export const listQueuedRenderJobs = async (
  supabase: SupabaseClient,
  limit = 3,
): Promise<RenderJobRow[]> => {
  const { data, error } = await supabase
    .from('render_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) {
    throw new Error(`Failed to list queued render jobs: ${error.message}`)
  }
  return (data ?? []) as RenderJobRow[]
}
