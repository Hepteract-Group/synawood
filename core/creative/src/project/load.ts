import type { SupabaseClient } from '@supabase/supabase-js'
import { parseStudioProject, type StudioProject } from './schema'

export type StudioProjectRow = {
  id: string
  product_id: string
  composition_id: string
  status: string
  model_profile_id: string
  /** When set, overrides profile.reasoner for the Studio Agent chat loop. */
  reasoner_model_id?: string | null
  /** When set, overrides profile.video for generate_video_clip. */
  video_model_id?: string | null
  project_json: unknown
  revision: number
  history_tip?: number
  /** ADR-0030 — active named branch tip mirrored in project_json. */
  active_branch_id?: string | null
  /** ADR-0027 — variant child points at parent first cut. */
  parent_project_id?: string | null
  /** ADR-0027 — VariantSpec JSON for child projects. */
  variant_spec?: unknown
  created_at: string
  updated_at: string
}

export const loadProject = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ row: StudioProjectRow; project: StudioProject }> => {
  const { data, error } = await supabase
    .from('studio_projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load project: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const row = data as StudioProjectRow
  const project = parseStudioProject({
    ...(typeof row.project_json === 'object' && row.project_json !== null ? row.project_json : {}),
    id: row.id,
    productId: row.product_id,
    compositionId: row.composition_id,
    status: row.status,
    revision: row.revision,
  })

  return { row, project }
}

export const listProjects = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<StudioProjectRow[]> => {
  const { data, error } = await supabase
    .from('studio_projects')
    .select('*')
    .eq('product_id', productId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`)
  }
  return (data ?? []) as StudioProjectRow[]
}
