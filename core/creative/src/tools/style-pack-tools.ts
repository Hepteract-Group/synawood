/** Style pack Studio Tools (ADR-0045 / #207). */

import { tool } from 'ai'
import { z } from 'zod'
import { applyProjectMutation, wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolOk } from './types'
import {
  applyFilterToClip,
  applyStylePackToProject,
  applyEffectToClip,
  clearEffectFromClip,
  regenEffect,
} from '../effects/apply'
import { listStylePacks } from '../effects/packs'

export const createStylePackTools = (ctx: StudioToolContext) => ({
  list_style_packs: tool({
    description:
      'List first-party Remotion look packs (cinematic teal-orange, luxury perfume, VHS). No spend.',
    inputSchema: z.object({}),
    execute: async (input) =>
      wrapTool(ctx, 'list_style_packs', input, async () =>
        toolOk('First-party style packs', {
          packs: listStylePacks().map((pack) => ({
            id: pack.id,
            label: pack.label,
            license: pack.license,
          })),
          active: ctx.project.stylePackId ?? null,
        }),
      ),
  }),

  set_style_pack: tool({
    description:
      'Apply or clear a first-party look pack on this project (preview grade). Pass packId null to clear. No generator spend.',
    inputSchema: z.object({
      packId: z.string().min(1).max(80).nullable(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'set_style_pack', input, async () => {
        const { project } = await applyProjectMutation(ctx, (current) =>
          applyStylePackToProject(current, input.packId),
        )
        return toolOk(
          project.stylePackId ? `Style pack is ${project.stylePackId}` : 'Style pack cleared',
          {
            stylePackId: project.stylePackId ?? null,
            revision: project.revision,
          },
        )
      }),
  }),

  apply_filter: tool({
    description:
      'Grade a clip (clipId) or the whole cut (omit clipId). Pass filterId null to clear. Same first-party packs as list_style_packs. No spend.',
    inputSchema: z.object({
      clipId: z.string().min(1).optional(),
      filterId: z.string().min(1).max(80).nullable(),
      intensity: z.number().min(0).max(1).optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'apply_filter', input, async () => {
        const { project } = await applyProjectMutation(ctx, (current) => {
          if (input.clipId) {
            return applyFilterToClip(current, {
              clipId: input.clipId,
              filterId: input.filterId,
              intensity: input.intensity,
            })
          }
          return applyStylePackToProject(current, input.filterId)
        })
        if (input.clipId) {
          const clip = project.clips.find((item) => item.id === input.clipId)
          return toolOk(
            clip?.filterId ? `Filter ${clip.filterId} on clip` : 'Clip filter cleared',
            {
              clipId: input.clipId,
              filterId: clip?.filterId ?? null,
              filterIntensity: clip?.filterIntensity ?? null,
              revision: project.revision,
            },
          )
        }
        return toolOk(
          project.stylePackId ? `Cut look is ${project.stylePackId}` : 'Cut look cleared',
          {
            stylePackId: project.stylePackId ?? null,
            revision: project.revision,
          },
        )
      }),
  }),

  clear_filter: tool({
    description: 'Clear a clip grade (clipId) or the whole-cut look (omit clipId). No spend.',
    inputSchema: z.object({
      clipId: z.string().min(1).optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'clear_filter', input, async () => {
        const { project } = await applyProjectMutation(ctx, (current) => {
          if (input.clipId) {
            return applyFilterToClip(current, { clipId: input.clipId, filterId: null })
          }
          return applyStylePackToProject(current, null)
        })
        return toolOk(input.clipId ? 'Clip filter cleared' : 'Cut look cleared', {
          clipId: input.clipId ?? null,
          stylePackId: project.stylePackId ?? null,
          revision: project.revision,
        })
      }),
  }),

  apply_effect: tool({
    description:
      'Apply a clip treatment: shake, glow, flash, or zoom_punch. Requires clipId. Intensity 0–1. No spend. Looks stay on Filters.',
    inputSchema: z.object({
      clipId: z.string().min(1),
      effectId: z.string().min(1).max(80),
      intensity: z.number().min(0).max(1).optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'apply_effect', input, async () => {
        const { project } = await applyProjectMutation(ctx, (current) =>
          applyEffectToClip(current, input),
        )
        const clip = project.clips.find((item) => item.id === input.clipId)
        return toolOk(`Applied ${input.effectId} to clip`, {
          clipId: input.clipId,
          treatments: clip?.treatments ?? [],
          revision: project.revision,
        })
      }),
  }),

  clear_effect: tool({
    description: 'Remove one treatment primitive from a clip. No spend.',
    inputSchema: z.object({
      clipId: z.string().min(1),
      effectId: z.string().min(1).max(80),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'clear_effect', input, async () => {
        const { project } = await applyProjectMutation(ctx, (current) =>
          clearEffectFromClip(current, input),
        )
        const clip = project.clips.find((item) => item.id === input.clipId)
        return toolOk(`Cleared ${input.effectId} from clip`, {
          clipId: input.clipId,
          treatments: clip?.treatments ?? [],
          revision: project.revision,
        })
      }),
  }),

  regen_effect: tool({
    description:
      'Re-run one clip treatment (shake, glow, flash, zoom_punch) without rebuilding the cut. Pass clipId and optional effectId (defaults to the last treatment on that clip). No spend. Then call inspect_preview. This does not replace inspect_preview.',
    inputSchema: z.object({
      clipId: z.string().min(1),
      effectId: z.string().min(1).max(80).optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'regen_effect', input, async () => {
        const { project } = await applyProjectMutation(ctx, (current) =>
          regenEffect(current, input),
        )
        const clip = project.clips.find((item) => item.id === input.clipId)
        return toolOk('Tried that treatment again', {
          clipId: input.clipId,
          treatments: clip?.treatments ?? [],
          revision: project.revision,
        })
      }),
  }),
})
