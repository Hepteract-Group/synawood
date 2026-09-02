/** Wave 2D / #184 — commit Director plan then fork active tip as a named branch. */

import type { DirectorPlan } from '../intent/schema'
import {
  createBranchFromActiveTip,
  switchActiveBranch,
  type StudioProjectBranchRow,
} from '../project'
import type { StudioProject } from '../project/schema'
import { applyProjectMutation } from '../tools/store'
import type { StudioToolContext } from '../tools/types'
import { applyDirectorPlanEdits, markPlanStaleIfNeeded } from './plan'
import { loadDirectorPlan, updateDirectorPlanStatus } from './persist'

export type CommitDirectorPlanInput = {
  planId: string
  excludeMutationIds?: string[]
}

export type CommitDirectorPlanOk = {
  ok: true
  plan: DirectorPlan
  appliedIds: string[]
  revision: number
  project: StudioProject
}

export type CommitDirectorPlanFail = {
  ok: false
  error: string
}

export type CommitDirectorPlanResult = CommitDirectorPlanOk | CommitDirectorPlanFail

export type SaveDirectorPlanAsBranchInput = CommitDirectorPlanInput & {
  branchName: string
  switchAfter?: boolean
}

export type SaveDirectorPlanAsBranchOk = CommitDirectorPlanOk & {
  branch: StudioProjectBranchRow
  switched: boolean
}

export type SaveDirectorPlanAsBranchResult = SaveDirectorPlanAsBranchOk | CommitDirectorPlanFail

const resolvePlan = async (
  ctx: StudioToolContext,
  planId: string,
): Promise<{ ok: true; plan: DirectorPlan } | CommitDirectorPlanFail> => {
  let plan = ctx.project.directorPlan
  if (!plan || plan.id !== planId) {
    if (!ctx.persist) {
      return { ok: false, error: `Director plan ${planId} not found on project` }
    }
    const loaded = await loadDirectorPlan(ctx.supabase, planId)
    if (!loaded) return { ok: false, error: `Director plan ${planId} not found` }
    plan = loaded.plan
  }
  return { ok: true, plan }
}

/** Apply a draft DirectorPlan onto the active tip (shared by commit + save-as-branch). */
export const commitDirectorPlanInContext = async (
  ctx: StudioToolContext,
  input: CommitDirectorPlanInput,
): Promise<CommitDirectorPlanResult> => {
  const resolved = await resolvePlan(ctx, input.planId)
  if (!resolved.ok) return resolved
  let plan = resolved.plan

  const maybeStale = markPlanStaleIfNeeded(plan, ctx.project.revision)
  if (maybeStale.status === 'stale') {
    if (ctx.persist) {
      await updateDirectorPlanStatus(ctx.supabase, {
        planId: plan.id,
        plan: maybeStale,
      })
    }
    return {
      ok: false,
      error: 'Director plan is stale (project changed). Call direct_project again to refresh.',
    }
  }
  if (plan.status !== 'draft') {
    return {
      ok: false,
      error: `Director plan status is ${plan.status}; only draft plans can be committed`,
    }
  }

  const exclude = input.excludeMutationIds ?? []
  const preview = applyDirectorPlanEdits(ctx.project, plan, exclude)
  if (preview.appliedIds.length === 0) {
    return { ok: false, error: 'No proposed edits left to apply after excludes' }
  }

  const { project } = await applyProjectMutation(ctx, (current) => {
    const result = applyDirectorPlanEdits(current, plan, exclude)
    return {
      ...result.project,
      directorPlan: undefined,
      directorRebuildPrompt: null,
    }
  })

  const appliedPlan: DirectorPlan = {
    ...plan,
    status: 'applied',
    projectRevision: project.revision,
    edits: plan.edits.map((edit) =>
      preview.appliedIds.includes(edit.id) ? edit : { ...edit, status: 'rejected' as const },
    ),
  }
  if (ctx.persist) {
    await updateDirectorPlanStatus(ctx.supabase, {
      planId: plan.id,
      plan: appliedPlan,
    })
  }
  ctx.project = { ...project, directorPlan: appliedPlan }

  return {
    ok: true,
    plan: appliedPlan,
    appliedIds: preview.appliedIds,
    revision: project.revision,
    project: ctx.project,
  }
}

/**
 * Commit a Director plan, then fork the **post-commit** active tip into a named branch.
 * Does not replace `main` — promote/merge (#183) is the intentional path onto main.
 */
export const saveDirectorPlanAsBranch = async (
  ctx: StudioToolContext,
  input: SaveDirectorPlanAsBranchInput,
): Promise<SaveDirectorPlanAsBranchResult> => {
  if (!ctx.persist) {
    return {
      ok: false,
      error: 'save_director_plan_as_branch requires a persisted project',
    }
  }

  const committed = await commitDirectorPlanInContext(ctx, {
    planId: input.planId,
    excludeMutationIds: input.excludeMutationIds,
  })
  if (!committed.ok) return committed

  const created = await createBranchFromActiveTip(ctx.supabase, {
    projectId: ctx.projectId,
    name: input.branchName,
  })

  let switched = false
  if (input.switchAfter) {
    const next = await switchActiveBranch(ctx.supabase, {
      projectId: ctx.projectId,
      branchId: created.branch.id,
    })
    ctx.project = { ...next.project, directorPlan: committed.plan }
    ctx.expectedRevision = next.project.revision
    switched = true
  }

  return {
    ...committed,
    project: ctx.project,
    branch: created.branch,
    switched,
  }
}
