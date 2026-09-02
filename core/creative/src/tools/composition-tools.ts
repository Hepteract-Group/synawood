import { tool } from 'ai'
import { z } from 'zod'
import { artDirectionSchema } from '../project/schema'
import {
  patchAuthoredComposition,
  setAuthoredMotionSeed,
  writeAuthoredComposition,
} from '../authored/write-composition'
import type { AuthoredCompileResult } from '../authored/compile'
import { motionKitCatalog } from '../motion-kit/catalog'
import { fetchRecentMotionFingerprints } from '../motion-kit/recent-fingerprints'
import { applyProjectMutation, wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolFail, toolOk } from './types'

const loadRecentFingerprints = async (ctx: StudioToolContext): Promise<string[]> => {
  if (!ctx.persist) return []
  try {
    return await fetchRecentMotionFingerprints(ctx.supabase, ctx.productId)
  } catch {
    return []
  }
}

const compileOutcome = (compile: AuthoredCompileResult) => {
  if (compile.ok) {
    return toolOk('Composition compiled. Watch the Player, then inspect_preview before you finish.')
  }
  return toolFail(compile.compileError)
}

export const createCompositionTools = (ctx: StudioToolContext) => ({
  list_motion_kit: tool({
    description:
      'List motion-kit dialects, layouts, and components with example snippets. No spend. Pick a dialect+layout, then write_composition.',
    inputSchema: z.object({}),
    execute: async (input) =>
      wrapTool(ctx, 'list_motion_kit', input, async () => {
        const catalog = motionKitCatalog()
        return toolOk(
          `Import from '@synawood/creative/motion-kit' only — not @motion-kit or @remotion/motion-kit. ${catalog.kitImport} Dialects: ${catalog.dialects.join(', ')}. Layouts: ${catalog.layouts.join(', ')}. Wipe families: fade, slide, iris, brand-wipe, star (SceneWipe presentationId). Components: ${catalog.components.map((row) => row.name).join(', ')}.`,
          { ...catalog },
        )
      }),
  }),

  write_composition: tool({
    description:
      'Replace this project with an authored Remotion TSX composition. Imports allowed: remotion, react, @synawood/creative/motion-kit, @remotion/lottie, @remotion/transitions. Never @motion-kit or @remotion/motion-kit. Sets compositionId to authored, runs the sandbox compiler. Operators never paste TSX — you write it. On compile error, source is kept so you can patch. Do not fall back to talking-head.',
    inputSchema: z.object({
      source: z.string().min(1).max(80_000),
      motionSeed: z.string().min(1).max(80).optional(),
      artDirection: artDirectionSchema.optional(),
      sequel: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'write_composition', input, async () => {
        const recentFingerprints = await loadRecentFingerprints(ctx)
        const drafted = writeAuthoredComposition(ctx.project, {
          source: input.source,
          motionSeed: input.motionSeed,
          artDirection: input.artDirection,
          recentFingerprints,
          sequel: input.sequel,
        })
        await applyProjectMutation(ctx, () => drafted.project, 'write_composition')
        return compileOutcome(drafted.compile)
      }),
  }),

  patch_composition: tool({
    description:
      'Search/replace inside the authored TSX, then recompile. Use after a compile error or inspect_preview fail. Do not switch to talking-head.',
    inputSchema: z.object({
      find: z.string().min(1).max(20_000),
      replace: z.string().max(20_000),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'patch_composition', input, async () => {
        const patched = patchAuthoredComposition(ctx.project, input)
        if (!patched.ok) return toolFail(patched.error)
        await applyProjectMutation(ctx, () => patched.project, 'patch_composition')
        return compileOutcome(patched.compile)
      }),
  }),

  set_motion_seed: tool({
    description:
      'New deterministic take of the same composition formula. Changes motionSeed; does not wipe source. Variety pick may change dialect.',
    inputSchema: z.object({
      motionSeed: z.string().min(1).max(80).optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'set_motion_seed', input, async () => {
        const recentFingerprints = await loadRecentFingerprints(ctx)
        const next = setAuthoredMotionSeed(ctx.project, {
          motionSeed: input.motionSeed,
          recentFingerprints,
        })
        if (!next.ok) return toolFail(next.error)
        await applyProjectMutation(ctx, () => next.project, 'set_motion_seed')
        return toolOk('Motion seed updated. Source is unchanged.', {
          motionSeed: next.project.compositionSource?.motionSeed,
          artDirection: next.project.compositionSource?.artDirection,
        })
      }),
  }),
})
