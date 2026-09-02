import type { SupabaseClient } from '@supabase/supabase-js'
import { writeActiveBranchTip } from './branches'
import { loadProject, type StudioProjectRow } from './load'
import { parseStudioProject, type StudioProject } from './schema'
import { RevisionConflictError } from './revision-conflict'

export type HistoryMeta = {
  canUndo: boolean
  canRedo: boolean
  historyTip: number
}

export const historyMetaFromRow = (
  row: Pick<StudioProjectRow, 'revision' | 'history_tip'>,
  options?: { hasPriorSnapshot?: boolean },
): HistoryMeta => {
  const tip = row.history_tip ?? row.revision
  const hasPrior = options?.hasPriorSnapshot ?? row.revision > 1
  return {
    canUndo: row.revision > 1 && hasPrior,
    canRedo: row.revision < tip,
    historyTip: tip,
  }
}

const revisionExists = async (
  supabase: SupabaseClient,
  projectId: string,
  revision: number,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('studio_project_revisions')
    .select('revision')
    .eq('project_id', projectId)
    .eq('revision', revision)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to probe revision ${revision}: ${error.message}`)
  }
  return data !== null
}

export const resolveHistoryMeta = async (
  supabase: SupabaseClient,
  projectId: string,
  row: Pick<StudioProjectRow, 'revision' | 'history_tip'>,
): Promise<HistoryMeta> => {
  const tip = row.history_tip ?? row.revision
  const hasPriorSnapshot =
    row.revision > 1 ? await revisionExists(supabase, projectId, row.revision - 1) : false
  return historyMetaFromRow({ revision: row.revision, history_tip: tip }, { hasPriorSnapshot })
}

const upsertRevision = async (
  supabase: SupabaseClient,
  projectId: string,
  revision: number,
  project: StudioProject,
): Promise<void> => {
  const { error } = await supabase.from('studio_project_revisions').upsert(
    {
      project_id: projectId,
      revision,
      project_json: project,
    },
    { onConflict: 'project_id,revision' },
  )
  if (error) {
    throw new Error(`Failed to record project revision: ${error.message}`)
  }
}

const loadRevisionSnapshot = async (
  supabase: SupabaseClient,
  projectId: string,
  revision: number,
): Promise<StudioProject | null> => {
  const { data, error } = await supabase
    .from('studio_project_revisions')
    .select('project_json')
    .eq('project_id', projectId)
    .eq('revision', revision)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load revision ${revision}: ${error.message}`)
  }
  if (!data?.project_json) return null
  return parseStudioProject({
    ...(typeof data.project_json === 'object' && data.project_json !== null
      ? data.project_json
      : {}),
    revision,
  })
}

/** Ensure the current head exists in the history table (lazy backfill). */
export const seedCurrentRevision = async (
  supabase: SupabaseClient,
  row: StudioProjectRow,
  project: StudioProject,
): Promise<void> => {
  await upsertRevision(supabase, project.id, project.revision, project)
  const tip = Math.max(row.history_tip ?? project.revision, project.revision)
  if ((row.history_tip ?? 0) < tip) {
    const { error } = await supabase
      .from('studio_projects')
      .update({ history_tip: tip })
      .eq('id', project.id)
    if (error) {
      throw new Error(`Failed to update history tip: ${error.message}`)
    }
  }
}

/**
 * After a successful forward save to `next`, truncate any redo branch and
 * record the new head. `previous` is the project that was live before the save.
 */
export const recordForwardRevision = async (
  supabase: SupabaseClient,
  previous: StudioProject,
  next: StudioProject,
): Promise<void> => {
  const { error: deleteError } = await supabase
    .from('studio_project_revisions')
    .delete()
    .eq('project_id', next.id)
    .gt('revision', previous.revision)
  if (deleteError) {
    throw new Error(`Failed to truncate redo history: ${deleteError.message}`)
  }

  await upsertRevision(supabase, previous.id, previous.revision, previous)
  await upsertRevision(supabase, next.id, next.revision, next)

  const { error: tipError } = await supabase
    .from('studio_projects')
    .update({ history_tip: next.revision })
    .eq('id', next.id)
  if (tipError) {
    throw new Error(`Failed to advance history tip: ${tipError.message}`)
  }
}

const restoreRevision = async (
  supabase: SupabaseClient,
  projectId: string,
  expectedRevision: number,
  targetRevision: number,
): Promise<{ row: StudioProjectRow; project: StudioProject; history: HistoryMeta }> => {
  const { row, project } = await loadProject(supabase, projectId)
  if (project.revision !== expectedRevision) {
    throw new RevisionConflictError(expectedRevision, project.revision)
  }

  await seedCurrentRevision(supabase, row, project)

  const snapshot = await loadRevisionSnapshot(supabase, projectId, targetRevision)
  if (!snapshot) {
    throw new Error(`No revision snapshot for ${targetRevision}`)
  }

  const tip = Math.max(row.history_tip ?? project.revision, project.revision)
  const restored = parseStudioProject({
    ...snapshot,
    id: project.id,
    productId: project.productId,
    revision: targetRevision,
  })

  const wrote = await writeActiveBranchTip(supabase, {
    projectId,
    next: restored,
    expectedRevision,
    historyTip: tip,
  })

  return {
    row: wrote.row,
    project: wrote.project,
    history: await resolveHistoryMeta(supabase, projectId, wrote.row),
  }
}

export const undoProject = async (
  supabase: SupabaseClient,
  projectId: string,
  expectedRevision: number,
): Promise<{ row: StudioProjectRow; project: StudioProject; history: HistoryMeta }> => {
  if (expectedRevision <= 1) {
    throw new Error('Nothing to undo')
  }
  return restoreRevision(supabase, projectId, expectedRevision, expectedRevision - 1)
}

export const redoProject = async (
  supabase: SupabaseClient,
  projectId: string,
  expectedRevision: number,
): Promise<{ row: StudioProjectRow; project: StudioProject; history: HistoryMeta }> => {
  const { row } = await loadProject(supabase, projectId)
  const tip = row.history_tip ?? row.revision
  if (expectedRevision >= tip) {
    throw new Error('Nothing to redo')
  }
  return restoreRevision(supabase, projectId, expectedRevision, expectedRevision + 1)
}
