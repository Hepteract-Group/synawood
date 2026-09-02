/** draft_generation_plan / update_generation_plan — ADR-0086 / #1063. */

import { tool } from 'ai'
import { z } from 'zod'
import {
  applyGenerationPlanToProject,
  draftGenerationPlan,
  generationPlanSceneSchema,
  generationPlanStatusSchema,
  updateGenerationPlan,
} from '../generation-plan'
import { applyProjectMutation, wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolFail, toolOk } from './types'

const draftInputSchema = z
  .object({
    goal: z.string().min(1).max(240).optional(),
    angle: z.string().min(1).max(240).optional(),
    tone: z.string().min(1).max(120).optional(),
    audience: z.string().min(1).max(240).optional(),
    runtimeSeconds: z.number().positive().max(600).optional(),
    platform: z.string().min(1).max(80).optional(),
    scenes: z.array(generationPlanSceneSchema).optional(),
    assetIds: z.array(z.string().uuid()).optional(),
    extraExtractUrls: z.array(z.string().url()).optional(),
    reExtractThisTurn: z.boolean().optional(),
    reasonerModelId: z.string().min(1).optional(),
    imageModelId: z.string().min(1).optional(),
    videoModelId: z.string().min(1).optional(),
    costEstimateGbp: z.number().nonnegative().optional(),
    status: generationPlanStatusSchema.optional(),
  })
  .strict()

const updateInputSchema = draftInputSchema
  .extend({
    planId: z.string().uuid(),
  })
  .strict()

const planToolContext = (ctx: StudioToolContext) => ({
  profileId: ctx.modelProfileId,
  disabledOptional: ctx.disabledOptional,
})

export const createGenerationPlanTools = (ctx: StudioToolContext) => ({
  draft_generation_plan: tool({
    description:
      'Draft a Generation Plan onto the project (scenes, dialogue, models, £ estimate). Does NOT call Gateway image/video — operator confirms spend and Apply is a later step. Prefer when paid make-an-ad or batch stills are requested.',
    inputSchema: draftInputSchema,
    execute: async (input) =>
      wrapTool(ctx, 'draft_generation_plan', input, async () => {
        const result = draftGenerationPlan(ctx.project, input, planToolContext(ctx))
        if (result.kind === 'noop') {
          return toolOk(result.reason, { mutated: false, noop: true })
        }

        const { project } = await applyProjectMutation(ctx, (current) =>
          applyGenerationPlanToProject(current, result.plan),
        )
        return toolOk(
          `Drafted Generation Plan (${result.plan.scenes.length} scene(s), £${result.plan.costEstimateGbp.toFixed(2)} est.)`,
          {
            plan: result.plan,
            planId: result.plan.id,
            revision: project.revision,
            mutated: true,
            costEstimateGbp: result.plan.costEstimateGbp,
          },
        )
      }),
  }),

  update_generation_plan: tool({
    description:
      'Patch an existing Generation Plan on the project (same plan id). Does NOT generate clips. Fails if no plan exists or the plan was already applied.',
    inputSchema: updateInputSchema,
    execute: async (input) =>
      wrapTool(ctx, 'update_generation_plan', input, async () => {
        const result = updateGenerationPlan(ctx.project, input, planToolContext(ctx))
        if (result.kind === 'noop') {
          return toolOk(result.reason, { mutated: false, noop: true })
        }
        if (result.kind === 'error') {
          return toolFail(result.error)
        }
        if (result.unchanged) {
          return toolOk('Generation Plan unchanged', {
            plan: result.plan,
            planId: result.plan.id,
            revision: ctx.project.revision,
            mutated: false,
          })
        }

        const { project } = await applyProjectMutation(ctx, (current) =>
          applyGenerationPlanToProject(current, result.plan),
        )
        return toolOk(`Updated Generation Plan (${result.plan.status})`, {
          plan: result.plan,
          planId: result.plan.id,
          revision: project.revision,
          mutated: true,
          costEstimateGbp: result.plan.costEstimateGbp,
        })
      }),
  }),
})
