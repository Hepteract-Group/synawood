import type { SupabaseClient } from '@supabase/supabase-js'
import { writeActiveBranchTip } from './branches'
import { recordForwardRevision, seedCurrentRevision } from './history'
import { loadProject, type StudioProjectRow } from './load'
import { DEFAULT_MODEL_PROFILE_ID } from '../model-profiles'
import {
  createEmptyProject,
  normalizeCompositionId,
  parseStudioProject,
  type CompositionId,
  type StudioProject,
} from './schema'

export { RevisionConflictError } from './revision-conflict'

export const createProject = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    compositionId?: CompositionId
    modelProfileId?: string
    /** Founder-facing display name. */
    name?: string
    /** Initial duration override (ADR-0014); defaults to the composition preset. */
    durationFrames?: number
    /** Channel slideshow preset when creating social-carousel / vertical-slideshow. */
    slideshowPresetId?: import('../presets/slideshow').SlideshowPresetId
  },
): Promise<{ row: StudioProjectRow; project: StudioProject }> => {
  const compositionId = normalizeCompositionId(input.compositionId ?? 'talking-head-60')

  const id = crypto.randomUUID()
  const project = createEmptyProject({
    id,
    productId: input.productId,
    compositionId,
    name: input.name,
    durationFrames: input.durationFrames,
    slideshowPresetId: input.slideshowPresetId,
  })

  const { data, error } = await supabase
    .from('studio_projects')
    .insert({
      id: project.id,
      product_id: project.productId,
      composition_id: project.compositionId,
      status: project.status,
      model_profile_id: input.modelProfileId ?? DEFAULT_MODEL_PROFILE_ID,
      project_json: project,
      revision: project.revision,
      history_tip: project.revision,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`)
  }

  const row = data as StudioProjectRow
  await seedCurrentRevision(supabase, row, project)
  return { row, project }
}

export const saveProject = async (
  supabase: SupabaseClient,
  project: StudioProject,
  expectedRevision: number,
): Promise<{ row: StudioProjectRow; project: StudioProject }> => {
  const parsed = parseStudioProject(project)
  const next = parseStudioProject({
    ...parsed,
    revision: expectedRevision + 1,
  })

  const wrote = await writeActiveBranchTip(supabase, {
    projectId: parsed.id,
    next,
    expectedRevision,
    historyTip: next.revision,
  })

  await recordForwardRevision(supabase, wrote.previous, wrote.project)

  return { row: wrote.row, project: wrote.project }
}

/** Rename founder-facing display name only (bumps revision). */
export const renameProject = async (
  supabase: SupabaseClient,
  projectId: string,
  name: string,
): Promise<{ row: StudioProjectRow; project: StudioProject }> => {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('name is required')
  }
  if (trimmed.length > 80) {
    throw new Error('name must be 80 characters or fewer')
  }
  const { project } = await loadProject(supabase, projectId)
  return saveProject(supabase, { ...project, name: trimmed }, project.revision)
}

/** Hard-delete studio project row (cascades render jobs / finals / revision history). */
export const deleteProject = async (supabase: SupabaseClient, projectId: string): Promise<void> => {
  const { data, error } = await supabase
    .from('studio_projects')
    .delete()
    .eq('id', projectId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Project not found: ${projectId}`)
  }
}
