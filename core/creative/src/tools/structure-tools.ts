/** Creative structure Studio Tools (ADR-0034 / #230). */

import { tool } from 'ai'
import { z } from 'zod'
import {
  deriveCreativeStructureOnProject,
  setCreativeStructureOnProject,
} from '../intent/mutations'
import { creativeBeatSchema, parseCreativeStructure } from '../intent/creative-structure'
import { applyProjectMutation, wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolOk } from './types'

export const createStructureTools = (ctx: StudioToolContext) => ({
  derive_creative_structure: tool({
    description:
      'Map current Scenes onto hook/education/trust/offer/cta beats using clip timing. Does not rebuild the timeline. No spend.',
    inputSchema: z.object({}),
    execute: async (input) =>
      wrapTool(ctx, 'derive_creative_structure', input, async () => {
        const { project } = await applyProjectMutation(ctx, deriveCreativeStructureOnProject)
        return toolOk(
          project.creativeStructure.beats.length === 0
            ? 'No beats derived. Add Scenes with hook/proof/offer/cta roles first.'
            : `Derived ${project.creativeStructure.beats.length} beat(s) from scenes`,
          {
            creativeStructure: project.creativeStructure,
            revision: project.revision,
          },
        )
      }),
  }),

  set_creative_structure: tool({
    description:
      'Replace creative structure beats manually (source becomes manual). Max 24 beats. No spend.',
    inputSchema: z
      .object({
        beats: z.array(creativeBeatSchema).max(24),
      })
      .strict(),
    execute: async (input) =>
      wrapTool(ctx, 'set_creative_structure', input, async () => {
        const structure = parseCreativeStructure({
          beats: input.beats,
          source: 'manual',
          derivedAt: new Date().toISOString(),
        })
        const { project } = await applyProjectMutation(ctx, (current) =>
          setCreativeStructureOnProject(current, structure),
        )
        return toolOk(`Set ${project.creativeStructure.beats.length} manual beat(s)`, {
          creativeStructure: project.creativeStructure,
          revision: project.revision,
        })
      }),
  }),
})
