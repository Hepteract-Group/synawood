/** assemble_broll — dry-run BrollPlan (ADR-0047 / #518). */

import { tool } from 'ai'
import { z } from 'zod'
import { findMoments } from '../asset-intelligence'
import {
  buildBrollPlan,
  commitBrollPlanToProject,
  fillGenerateRow,
  fillMusicRow,
  findDraftBrollPlanByHash,
  hashAssembleBrollInput,
  loadBrollPlan,
  queryForScene,
  saveBrollPlan,
  scenesToCover,
  updateBrollPlanStatus,
  type BrollPlan,
} from '../broll'
import { applyProjectMutation, wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolFail, toolOk } from './types'

const retrieveMoments = async (
  ctx: StudioToolContext,
  sceneIds?: string[],
): Promise<Record<string, Awaited<ReturnType<typeof findMoments>>>> => {
  const scenes = scenesToCover(ctx.project, sceneIds)
  const momentsByScene: Record<string, Awaited<ReturnType<typeof findMoments>>> = {}
  for (const scene of scenes) {
    try {
      momentsByScene[scene.id] = await findMoments({
        supabase: ctx.supabase,
        productId: ctx.productId,
        query: queryForScene(ctx.project, scene),
        sceneRole: scene.role === 'custom' ? undefined : scene.role,
        limit: 8,
        useMock: ctx.modelProfileId === 'ci-stub',
        blobEnv: ctx.blobEnv,
      })
    } catch {
      momentsByScene[scene.id] = []
    }
  }
  return momentsByScene
}

const mirrorPlan = (ctx: StudioToolContext, plan: BrollPlan): void => {
  ctx.project = { ...ctx.project, brollPlan: plan }
}

export const createBrollTools = (ctx: StudioToolContext) => ({
  reject_broll_plan: tool({
    description:
      'Reject a draft overlay plan without applying. Persists status=rejected so reload does not resurrect the banner.',
    inputSchema: z.object({
      planId: z.string().uuid(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'reject_broll_plan', input, async () => {
        let plan: BrollPlan | null =
          ctx.project.brollPlan?.id === input.planId ? ctx.project.brollPlan : null
        if (!plan && ctx.persist) {
          const loaded = await loadBrollPlan(ctx.supabase, input.planId)
          plan = loaded?.plan ?? null
        }
        if (!plan) {
          return toolFail(`No overlay plan ${input.planId}. Call assemble_broll first.`)
        }
        if (plan.status !== 'draft' && plan.status !== 'stale') {
          return toolFail(
            `Overlay plan status is ${plan.status}; only draft or stale plans can be rejected`,
          )
        }
        const rejectedPlan = {
          ...plan,
          status: 'rejected' as const,
          projectRevision: ctx.project.revision,
        }
        if (ctx.persist) {
          await updateBrollPlanStatus(ctx.supabase, {
            planId: plan.id,
            plan: rejectedPlan,
          })
        }
        const { project } = await applyProjectMutation(ctx, (current) => ({
          ...current,
          brollPlan: rejectedPlan,
          revision: current.revision + 1,
        }))
        return toolOk('Rejected overlay plan', {
          plan: rejectedPlan,
          revision: project.revision,
          mutated: true,
        })
      }),
  }),

  assemble_broll: tool({
    description:
      'Draft a library-first overlay plan (clips from the library vs new clips vs music + £ estimate). dryRun defaults true and NEVER writes clips. There is no founder Picture plan UI — call commit_broll_plan in the same turn (confirmSpend when £>0). Prefer this over placing shots one-by-one when covering Scenes.',
    inputSchema: z.object({
      sceneIds: z.array(z.string().min(1)).min(1).optional(),
      dryRun: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'assemble_broll', input, async () => {
        const dryRun = input.dryRun !== false
        const assembleInput = { sceneIds: input.sceneIds, dryRun }
        const inputHash = hashAssembleBrollInput(
          ctx.project.id,
          ctx.project.revision,
          assembleInput,
        )

        if (ctx.persist) {
          const cached = await findDraftBrollPlanByHash(ctx.supabase, {
            projectId: ctx.project.id,
            projectRevision: ctx.project.revision,
            inputHash,
          })
          if (cached) {
            mirrorPlan(ctx, cached.plan)
            return toolOk('Reused cached overlay plan (same revision + inputs)', {
              plan: cached.plan,
              planId: cached.plan.id,
              source: 'cache',
              dryRun,
              mutated: false,
            })
          }
        }

        const momentsByScene = await retrieveMoments(ctx, input.sceneIds)
        const plan = buildBrollPlan({
          project: ctx.project,
          modelProfileId: ctx.modelProfileId,
          sceneIds: input.sceneIds,
          momentsByScene,
        })

        if (ctx.persist) {
          await saveBrollPlan(ctx.supabase, {
            productId: ctx.productId,
            projectId: ctx.project.id,
            inputHash,
            plan,
          })
        }
        mirrorPlan(ctx, plan)

        const generateCount = plan.rows.filter(
          (row) => row.kind === 'generate' || row.kind === 'still',
        ).length
        const momentCount = plan.rows.filter((row) => row.kind === 'moment').length
        const musicCount = plan.rows.filter((row) => row.kind === 'music').length
        const musicNote = musicCount > 0 ? `, ${musicCount} music bed` : ''
        return toolOk(
          `Overlay plan ${plan.id}: ${momentCount} library clip(s), ${generateCount} new clip(s) to generate${musicNote}. Commit now with commit_broll_plan (confirmSpend if £>0). There is no Picture plan screen.`,
          {
            plan,
            planId: plan.id,
            source: 'heuristic',
            dryRun,
            mutated: false,
            estimatedGbp: plan.estimatedGbp,
          },
        )
      }),
  }),

  commit_broll_plan: tool({
    description:
      'Apply a drafted overlay plan: place library Moments on the overlay track, generate-to-fill unmatched beats, add a music bed when the plan includes one, and assign clips to Scenes. Pass confirmSpend=true when the plan estimate is > £0. Does not roll back already-placed shots if a later row fails. Skip locked scenes.',
    inputSchema: z.object({
      planId: z.string().uuid(),
      confirmSpend: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'commit_broll_plan', input, async () => {
        let plan: BrollPlan | null =
          ctx.project.brollPlan?.id === input.planId ? ctx.project.brollPlan : null
        if (!plan && ctx.persist) {
          const loaded = await loadBrollPlan(ctx.supabase, input.planId)
          plan = loaded?.plan ?? null
        }
        if (!plan) {
          return toolFail(`No overlay plan ${input.planId}. Call assemble_broll first.`)
        }

        const result = await commitBrollPlanToProject(ctx.project, plan, {
          confirmSpend: Boolean(input.confirmSpend || ctx.confirmSpend),
          fillGenerate: ({ project, row, from, until }) =>
            fillGenerateRow({
              project,
              row,
              from,
              until,
              modelProfileId: ctx.modelProfileId,
            }),
          fillMusic: ({ project, row }) =>
            fillMusicRow({
              project,
              row,
              modelProfileId: ctx.modelProfileId,
            }),
        })
        if (!result.ok) return toolFail(result.error)

        const { project } = await applyProjectMutation(ctx, () => result.project)
        if (ctx.persist) {
          await updateBrollPlanStatus(ctx.supabase, {
            planId: result.plan.id,
            plan: { ...result.plan, projectRevision: project.revision },
          })
        }

        const pending =
          result.pendingGenerate + result.pendingMusic > 0
            ? ` ${result.pendingGenerate} generate-to-fill and ${result.pendingMusic} music row(s) still pending.`
            : ''
        const skipped =
          result.skippedLocked.length > 0
            ? ` Skipped locked scene(s): ${result.skippedLocked.join(', ')}.`
            : ''
        const errors =
          result.rowErrors.length > 0 ? ` ${result.rowErrors.length} row warning(s).` : ''
        return toolOk(
          `Applied overlay plan (${result.placedClipIds.length} clip(s)).${pending}${skipped}${errors}`,
          {
            plan: project.brollPlan,
            planId: result.plan.id,
            placedClipIds: result.placedClipIds,
            pendingGenerate: result.pendingGenerate,
            pendingMusic: result.pendingMusic,
            skippedLocked: result.skippedLocked,
            rowErrors: result.rowErrors,
            revision: project.revision,
            mutated: true,
          },
        )
      }),
  }),
})
