/** Wave 2D / #183 — create / switch / promote / merge branch operations. */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  compactBranchTip,
  isMainBranchSlug,
  listBranches,
  MAIN_BRANCH_NAME,
  resolveActiveBranch,
  resolveBranchById,
  resolveBranchBySlug,
  resolveMainBranch,
  slugifyBranchName,
  type ResolvedBranch,
  type StudioProjectBranchRow,
} from './branches'
import { type StudioProjectRow } from './load'
import { RevisionConflictError } from './revision-conflict'
import { parseStudioProject, type StudioProject } from './schema'

export type BranchSummary = {
  id: string
  name: string
  slug: string
  isMain: boolean
  isActive: boolean
  parentBranchId: string | null
  forkedFromRevision: number | null
  revision: number
  updatedAt: string
}

export const summarizeBranchRow = (
  row: StudioProjectBranchRow,
  activeBranchId: string | null | undefined,
): BranchSummary => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  isMain: row.is_main,
  isActive: row.id === activeBranchId,
  parentBranchId: row.parent_branch_id,
  forkedFromRevision: row.forked_from_revision,
  revision: row.revision,
  updatedAt: row.updated_at,
})

export const listBranchSummaries = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ branches: BranchSummary[]; activeBranchId: string | null }> => {
  const resolved = await resolveActiveBranch(supabase, projectId)
  const rows = await listBranches(supabase, projectId)
  const activeBranchId = resolved.branch.id
  return {
    activeBranchId,
    branches: rows.map((branch) => summarizeBranchRow(branch, activeBranchId)),
  }
}

const assertCreatableBranchName = (name: string): { name: string; slug: string } => {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Branch name is required')
  }
  if (trimmed.length > 40) {
    throw new Error('Branch name must be 40 characters or fewer')
  }
  const slug = slugifyBranchName(trimmed)
  if (isMainBranchSlug(slug) || trimmed.toLowerCase() === MAIN_BRANCH_NAME) {
    throw new Error('Branch name "main" is reserved')
  }
  return { name: trimmed, slug }
}

export const BRANCH_EXISTS_PREFIX = 'Branch slug already exists:'

export const branchExistsError = (slug: string): Error =>
  new Error(`${BRANCH_EXISTS_PREFIX} ${slug}`)

export const isBranchExistsError = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith(BRANCH_EXISTS_PREFIX)

/** Fork the active tip into a new named branch (full tip clone; no revision bump). */
export const createBranchFromActiveTip = async (
  supabase: SupabaseClient,
  input: { projectId: string; name: string },
): Promise<{ branch: StudioProjectBranchRow; forkedFrom: StudioProjectBranchRow }> => {
  const { name, slug } = assertCreatableBranchName(input.name)
  const resolved = await resolveActiveBranch(supabase, input.projectId)

  try {
    await resolveBranchBySlug(supabase, { projectId: input.projectId, slug })
    throw branchExistsError(slug)
  } catch (error) {
    if (isBranchExistsError(error)) {
      throw error
    }
    if (!(error instanceof Error) || !/Branch not found/i.test(error.message)) {
      throw error
    }
  }

  const tipJson = resolved.project as unknown as Record<string, unknown>
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const { data, error } = await supabase
    .from('studio_project_branches')
    .insert({
      id,
      project_id: input.projectId,
      name,
      slug,
      is_main: false,
      parent_branch_id: resolved.branch.id,
      forked_from_revision: resolved.branch.revision,
      project_json: tipJson,
      revision: resolved.branch.revision,
      created_at: now,
      updated_at: now,
    })
    .select(
      'id, project_id, name, slug, is_main, parent_branch_id, forked_from_revision, project_json, revision, created_at, updated_at',
    )
    .single()

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw branchExistsError(slug)
    }
    throw new Error(`Failed to create branch: ${error.message}`)
  }

  return { branch: data as StudioProjectBranchRow, forkedFrom: resolved.branch }
}

/**
 * Point the project at another branch tip and mirror that tip onto
 * `studio_projects.project_json` / `revision` (no tip mutation).
 */
export const switchActiveBranch = async (
  supabase: SupabaseClient,
  input: { projectId: string; branchId?: string; slug?: string },
): Promise<ResolvedBranch & { row: StudioProjectRow }> => {
  if (!input.branchId && !input.slug) {
    throw new Error('branchId or slug is required')
  }

  const { row } = await resolveActiveBranch(supabase, input.projectId)
  const branch = input.branchId
    ? await resolveBranchById(supabase, {
        projectId: input.projectId,
        branchId: input.branchId,
      })
    : await resolveBranchBySlug(supabase, {
        projectId: input.projectId,
        slug: input.slug!,
      })

  const tip = compactBranchTip(branch, row)
  const tipJson = tip as unknown as Record<string, unknown>
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('studio_projects')
    .update({
      active_branch_id: branch.id,
      product_id: tip.productId,
      composition_id: tip.compositionId,
      status: tip.status,
      project_json: tipJson,
      revision: tip.revision,
      updated_at: now,
    })
    .eq('id', input.projectId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to switch branch: ${error.message}`)
  }

  return {
    row: data as StudioProjectRow,
    branch,
    project: tip,
  }
}

/**
 * v1 merge/promote: full tip replace onto target (no 3-way / sparse merge).
 * If the target is the active branch, also re-mirror the project row.
 */
export const replaceBranchTip = async (
  supabase: SupabaseClient,
  input: {
    projectId: string
    sourceBranchId: string
    targetBranchId: string
    expectedTargetRevision: number
  },
): Promise<{
  source: StudioProjectBranchRow
  target: StudioProjectBranchRow
  project: StudioProject
  row: StudioProjectRow
}> => {
  if (input.sourceBranchId === input.targetBranchId) {
    throw new Error('Source and target branch must differ')
  }

  const source = await resolveBranchById(supabase, {
    projectId: input.projectId,
    branchId: input.sourceBranchId,
  })
  const target = await resolveBranchById(supabase, {
    projectId: input.projectId,
    branchId: input.targetBranchId,
  })

  if (target.revision !== input.expectedTargetRevision) {
    throw new RevisionConflictError(input.expectedTargetRevision, target.revision)
  }

  const { row } = await resolveActiveBranch(supabase, input.projectId)
  const next = parseStudioProject({
    ...(typeof source.project_json === 'object' && source.project_json !== null
      ? source.project_json
      : {}),
    id: row.id,
    productId: row.product_id,
    compositionId: row.composition_id,
    status: row.status,
    revision: input.expectedTargetRevision + 1,
  })
  const tipJson = next as unknown as Record<string, unknown>
  const now = new Date().toISOString()

  const { data: targetData, error: targetError } = await supabase
    .from('studio_project_branches')
    .update({
      project_json: tipJson,
      revision: next.revision,
      updated_at: now,
    })
    .eq('id', target.id)
    .eq('project_id', input.projectId)
    .eq('revision', input.expectedTargetRevision)
    .select(
      'id, project_id, name, slug, is_main, parent_branch_id, forked_from_revision, project_json, revision, created_at, updated_at',
    )
    .maybeSingle()

  if (targetError) {
    throw new Error(`Failed to replace branch tip: ${targetError.message}`)
  }
  if (!targetData) {
    const { data: latest } = await supabase
      .from('studio_project_branches')
      .select('revision')
      .eq('id', target.id)
      .maybeSingle()
    throw new RevisionConflictError(
      input.expectedTargetRevision,
      (latest?.revision as number) ?? -1,
    )
  }

  let nextRow = row
  if (row.active_branch_id === target.id) {
    const { data: projectData, error: projectError } = await supabase
      .from('studio_projects')
      .update({
        product_id: next.productId,
        composition_id: next.compositionId,
        status: next.status,
        project_json: tipJson,
        revision: next.revision,
        history_tip: Math.max(row.history_tip ?? next.revision, next.revision),
        updated_at: now,
      })
      .eq('id', input.projectId)
      .eq('active_branch_id', target.id)
      .eq('revision', input.expectedTargetRevision)
      .select('*')
      .maybeSingle()

    if (projectError) {
      throw new Error(`Failed to mirror replaced tip: ${projectError.message}`)
    }
    if (!projectData) {
      // Active pointer or revision moved mid-flight — tip write already landed;
      // leave mirror for the next switch/save rather than overwrite a new active tip.
      const { data: latest } = await supabase
        .from('studio_projects')
        .select('*')
        .eq('id', input.projectId)
        .maybeSingle()
      nextRow = (latest as StudioProjectRow | null) ?? row
    } else {
      nextRow = projectData as StudioProjectRow
    }
  }

  return {
    source,
    target: targetData as StudioProjectBranchRow,
    project: next,
    row: nextRow,
  }
}

export const promoteBranchToMain = async (
  supabase: SupabaseClient,
  input: { projectId: string; sourceBranchId?: string; sourceSlug?: string },
): Promise<{
  source: StudioProjectBranchRow
  target: StudioProjectBranchRow
  project: StudioProject
  row: StudioProjectRow
}> => {
  if (!input.sourceBranchId && !input.sourceSlug) {
    throw new Error('sourceBranchId or sourceSlug is required')
  }
  const source = input.sourceBranchId
    ? await resolveBranchById(supabase, {
        projectId: input.projectId,
        branchId: input.sourceBranchId,
      })
    : await resolveBranchBySlug(supabase, {
        projectId: input.projectId,
        slug: input.sourceSlug!,
      })

  if (source.is_main) {
    throw new Error('Cannot promote main onto itself — pick a non-main source branch')
  }

  const main = await resolveMainBranch(supabase, input.projectId)
  return replaceBranchTip(supabase, {
    projectId: input.projectId,
    sourceBranchId: source.id,
    targetBranchId: main.id,
    expectedTargetRevision: main.revision,
  })
}

export const mergeBranchTip = async (
  supabase: SupabaseClient,
  input: {
    projectId: string
    sourceSlug: string
    targetSlug?: string
    expectedTargetRevision?: number
  },
): Promise<{
  source: StudioProjectBranchRow
  target: StudioProjectBranchRow
  project: StudioProject
  row: StudioProjectRow
}> => {
  const targetSlug = (input.targetSlug ?? MAIN_BRANCH_NAME).trim().toLowerCase()
  const source = await resolveBranchBySlug(supabase, {
    projectId: input.projectId,
    slug: input.sourceSlug,
  })
  const target = await resolveBranchBySlug(supabase, {
    projectId: input.projectId,
    slug: targetSlug,
  })
  const expected = input.expectedTargetRevision ?? target.revision
  return replaceBranchTip(supabase, {
    projectId: input.projectId,
    sourceBranchId: source.id,
    targetBranchId: target.id,
    expectedTargetRevision: expected,
  })
}
