import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProject } from '../project/load'

export type RenderTargets = 'stills' | 'mp4' | 'both'

export type RenderJobRow = {
  id: string
  product_id: string
  project_id: string
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  output_asset_ids: string[]
  duration_ms: number | null
  error_message: string | null
  attempt_count?: number
  targets?: RenderTargets
  created_at: string
  updated_at: string
}

export const enqueueRenderJob = async (
  supabase: SupabaseClient,
  projectId: string,
  options?: { targets?: RenderTargets },
): Promise<RenderJobRow> => {
  const { project } = await loadProject(supabase, projectId)
  const targets = options?.targets ?? 'both'

  const { data, error } = await supabase
    .from('render_jobs')
    .insert({
      product_id: project.productId,
      project_id: project.id,
      status: 'queued',
      output_asset_ids: [],
      error_message: null,
      targets,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to enqueue render job: ${error.message}`)
  }

  await supabase
    .from('studio_projects')
    .update({ status: 'rendering', updated_at: new Date().toISOString() })
    .eq('id', project.id)

  return data as RenderJobRow
}
