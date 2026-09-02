/** Wave 2D / ADR-0030 — named branch constants + resolve/compact. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProject, type StudioProjectRow } from './load'
import { RevisionConflictError } from './revision-conflict'
import { parseStudioProject, type StudioProject } from './schema'

export const MAIN_BRANCH_NAME = 'main'
export const MAIN_BRANCH_SLUG = 'main'

export const isMainBranchSlug = (slug: string): boolean => slug === MAIN_BRANCH_SLUG

export type StudioProjectBranchRow = {
  id: string
  project_id: string
  name: string
  slug: string
  is_main: boolean
  parent_branch_id: string | null
  forked_from_revision: number | null
  project_json: unknown
  revision: number
  created_at: string
  updated_at: string
}

export type ResolvedBranch = {
  branch: StudioProjectBranchRow
  /** Parsed tip; ids/status taken from the parent project row. */
  project: StudioProject
}

const branchSelect =
  'id, project_id, name, slug, is_main, parent_branch_id, forked_from_revision, project_json, revision, created_at, updated_at'

export const slugifyBranchName = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || MAIN_BRANCH_SLUG
}

/** Normalize a branch tip to a full StudioProject (v1 tips are already full JSON). */
export const compactBranchTip = (
  branch: StudioProjectBranchRow,
  projectRow: Pick<StudioProjectRow, 'id' | 'product_id' | 'composition_id' | 'status'>,
): StudioProject =>
  parseStudioProject({
    ...(typeof branch.project_json === 'object' && branch.project_json !== null
      ? branch.project_json
      : {}),
    id: projectRow.id,
    productId: projectRow.product_id,
    compositionId: projectRow.composition_id,
    status: projectRow.status,
    revision: branch.revision,
  })

export const listBranches = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<StudioProjectBranchRow[]> => {
  const { data, error } = await supabase
    .from('studio_project_branches')
    .select(branchSelect)
    .eq('project_id', projectId)
    .order('is_main', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to list branches: ${error.message}`)
  }
  return (data ?? []) as StudioProjectBranchRow[]
}

export const resolveBranchById = async (
  supabase: SupabaseClient,
  input: { projectId: string; branchId: string },
): Promise<StudioProjectBranchRow> => {
  const { data, error } = await supabase
    .from('studio_project_branches')
    .select(branchSelect)
    .eq('project_id', input.projectId)
    .eq('id', input.branchId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load branch: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Branch not found: ${input.branchId}`)
  }
  return data as StudioProjectBranchRow
}

export const resolveBranchBySlug = async (
  supabase: SupabaseClient,
  input: { projectId: string; slug: string },
): Promise<StudioProjectBranchRow> => {
  const slug = input.slug.trim().toLowerCase()
  const { data, error } = await supabase
    .from('studio_project_branches')
    .select(branchSelect)
    .eq('project_id', input.projectId)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load branch: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Branch not found: ${slug}`)
  }
  return data as StudioProjectBranchRow
}

export const resolveMainBranch = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<StudioProjectBranchRow> => {
  const { data, error } = await supabase
    .from('studio_project_branches')
    .select(branchSelect)
    .eq('project_id', projectId)
    .eq('is_main', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load main branch: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Main branch missing for project: ${projectId}`)
  }
  return data as StudioProjectBranchRow
}

/**
 * Active tip for tools/UI. Falls back to `main` when `active_branch_id` is unset
 * or points at a deleted row.
 */
export const resolveActiveBranch = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<ResolvedBranch & { row: StudioProjectRow }> => {
  const { row } = await loadProject(supabase, projectId)
  let branch: StudioProjectBranchRow | null = null

  if (row.active_branch_id) {
    const { data, error } = await supabase
      .from('studio_project_branches')
      .select(branchSelect)
      .eq('project_id', projectId)
      .eq('id', row.active_branch_id)
      .maybeSingle()
    if (error) {
      throw new Error(`Failed to load active branch: ${error.message}`)
    }
    branch = (data as StudioProjectBranchRow | null) ?? null
  }

  if (!branch) {
    branch = await resolveMainBranch(supabase, projectId)
  }

  return {
    row,
    branch,
    project: compactBranchTip(branch, row),
  }
}

/**
 * Re-sync denormalized `studio_projects.project_json` / `revision` from the
 * active branch tip (ADR-0030 compact). Optionally writes a normalized tip
 * back onto the branch row when parse fills defaults.
 */
export const syncActiveBranchMirror = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<ResolvedBranch & { row: StudioProjectRow }> => {
  const resolved = await resolveActiveBranch(supabase, projectId)
  const tip = resolved.project
  const tipJson = tip as unknown as Record<string, unknown>

  const { error: branchError } = await supabase
    .from('studio_project_branches')
    .update({
      project_json: tipJson,
      revision: tip.revision,
      updated_at: new Date().toISOString(),
    })
    .eq('id', resolved.branch.id)
    .eq('project_id', projectId)

  if (branchError) {
    throw new Error(`Failed to compact branch tip: ${branchError.message}`)
  }

  const { data, error } = await supabase
    .from('studio_projects')
    .update({
      project_json: tipJson,
      revision: tip.revision,
      active_branch_id: resolved.branch.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to sync active branch mirror: ${error.message}`)
  }

  const row = data as StudioProjectRow
  return {
    row,
    branch: {
      ...resolved.branch,
      project_json: tipJson,
      revision: tip.revision,
    },
    project: tip,
  }
}

export type WriteActiveBranchTipResult = {
  row: StudioProjectRow
  branch: StudioProjectBranchRow
  project: StudioProject
  /** Tip before this write (for history / undo bookkeeping). */
  previous: StudioProject
}

/**
 * Dual-write a tip onto the active branch + denormalized project row (#182).
 * Optimistic concurrency: both rows must currently be at `expectedRevision`.
 */
export const writeActiveBranchTip = async (
  supabase: SupabaseClient,
  input: {
    projectId: string
    next: StudioProject
    expectedRevision: number
    /** Extra project-row columns (history cursor restores keep tip; saves advance it). */
    historyTip?: number
  },
): Promise<WriteActiveBranchTipResult> => {
  const resolved = await resolveActiveBranch(supabase, input.projectId)

  if (resolved.project.revision !== input.expectedRevision) {
    throw new RevisionConflictError(input.expectedRevision, resolved.project.revision)
  }
  if (resolved.branch.revision !== input.expectedRevision) {
    throw new RevisionConflictError(input.expectedRevision, resolved.branch.revision)
  }

  const tipJson = input.next as unknown as Record<string, unknown>
  const now = new Date().toISOString()

  const { data: branchData, error: branchError } = await supabase
    .from('studio_project_branches')
    .update({
      project_json: tipJson,
      revision: input.next.revision,
      updated_at: now,
    })
    .eq('id', resolved.branch.id)
    .eq('project_id', input.projectId)
    .eq('revision', input.expectedRevision)
    .select(branchSelect)
    .maybeSingle()

  if (branchError) {
    throw new Error(`Failed to save active branch tip: ${branchError.message}`)
  }
  if (!branchData) {
    const { data: latestBranch } = await supabase
      .from('studio_project_branches')
      .select('revision')
      .eq('id', resolved.branch.id)
      .maybeSingle()
    throw new RevisionConflictError(
      input.expectedRevision,
      (latestBranch?.revision as number) ?? -1,
    )
  }

  const historyTip = input.historyTip ?? input.next.revision
  const { data, error } = await supabase
    .from('studio_projects')
    .update({
      product_id: input.next.productId,
      composition_id: input.next.compositionId,
      status: input.next.status,
      project_json: tipJson,
      revision: input.next.revision,
      history_tip: historyTip,
      active_branch_id: resolved.branch.id,
      updated_at: now,
    })
    .eq('id', input.projectId)
    .eq('revision', input.expectedRevision)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to save project mirror: ${error.message}`)
  }
  if (!data) {
    const { data: latest } = await supabase
      .from('studio_projects')
      .select('revision')
      .eq('id', input.projectId)
      .maybeSingle()
    throw new RevisionConflictError(input.expectedRevision, (latest?.revision as number) ?? -1)
  }

  return {
    row: data as StudioProjectRow,
    branch: branchData as StudioProjectBranchRow,
    project: input.next,
    previous: resolved.project,
  }
}
