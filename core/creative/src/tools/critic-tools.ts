import { tool } from 'ai'
import { z } from 'zod'
import { spawnCutReviewStills } from '../critic/spawn-cut-stills'
import { loadCriticSkillsExcerpt } from '../critic/skills'
import {
  inspectCut,
  isCiStubProfile,
  rubricDimensionsFromFull,
  stampFailedCutReview,
  stampPassedCutReview,
} from '../critic/inspect-preview'
import { fetchRecentMotionFingerprints } from '../motion-kit/recent-fingerprints'
import { recordBillingEventOnceBestEffort } from '../billing/events'
import { repairPictureToBrief } from '../project/operations'
import { applyProjectMutation, wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolFail, toolOk } from './types'

const liveRenderFrames = (ctx: StudioToolContext) => {
  if (!ctx.persist || isCiStubProfile(ctx.modelProfileId)) return undefined
  return async (frames: number[]) =>
    spawnCutReviewStills({
      project: ctx.project,
      blobEnv: ctx.blobEnv,
      frames,
    })
}

const persistCutReviewResult = async (
  ctx: StudioToolContext,
  result: Awaited<ReturnType<typeof inspectCut>>,
) => {
  if (result.phase !== 'vision') return
  const frames = result.frames
  const notes = result.rubric.notes || undefined
  const rubric = rubricDimensionsFromFull(result.rubric)
  await applyProjectMutation(
    ctx,
    (current) =>
      result.ok
        ? stampPassedCutReview(current, frames, notes, rubric)
        : stampFailedCutReview(current, frames, notes, rubric),
    'inspect_preview',
  )
}

export const createCriticTools = (ctx: StudioToolContext) => ({
  inspect_preview: tool({
    description:
      'Required cut review before you can say a video, carousel, or authored motion ad is done. Looks at the real player (compiled authored tree included): picture coverage, overlays/end card timing, then frames at start/middle/end. Mechanical length, static type, and invented CountUp/BrandText claims fail here before judging. Failures are errors. Fix remaining issues and call again in this turn. Never ask the founder what to do. Never narrate success if this returns ok:false.',
    inputSchema: z.object({}),
    execute: async () =>
      wrapTool(ctx, 'inspect_preview', {}, async () => {
        const repaired = repairPictureToBrief(ctx.project)
        if (repaired !== ctx.project) {
          await applyProjectMutation(
            ctx,
            (current) => repairPictureToBrief(current),
            'inspect_preview',
          )
        }
        const recentMotionFingerprints = ctx.persist
          ? await fetchRecentMotionFingerprints(ctx.supabase, ctx.productId).catch(() => [])
          : []
        const result = await inspectCut(ctx.project, {
          modelProfileId: ctx.modelProfileId,
          renderFrames: liveRenderFrames(ctx),
          skillsExcerpt: await loadCriticSkillsExcerpt(ctx.productId),
          recentMotionFingerprints,
        })
        await persistCutReviewResult(ctx, result)
        if (!result.ok) return toolFail(result.error ?? 'Cut review failed.')
        const frames = result.phase === 'vision' ? result.frames : []
        if (ctx.persist) {
          await recordBillingEventOnceBestEffort(ctx.supabase, {
            productId: ctx.productId,
            name: 'first_preview',
            payload: { projectId: ctx.projectId },
          })
        }
        return toolOk('Cut review passed. The player has picture for the requested length.', {
          phase: result.phase,
          frames,
        })
      }),
  }),
})
