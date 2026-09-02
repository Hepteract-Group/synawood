/** Picture-in-picture / split layout Studio Tools (ADR-0046). */

import { tool } from 'ai'
import { z } from 'zod'
import { applyProjectMutation, wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolOk } from './types'
import {
  applyPipLayoutToProject,
  mergePipLayout,
  PIP_LAYOUT_PRESETS,
  pipAxisSchema,
  pipMainSideSchema,
  pipModeSchema,
  pipPresetIdSchema,
} from '../project/pip-layout'

export const createPipLayoutTools = (ctx: StudioToolContext) => ({
  set_pip_layout: tool({
    description:
      'Place overlay picture relative to the main video. Presets: bottom-right, top-right, bottom-left, top-left (small inset), side-by-side, news (presenter left, graphic right). Split keeps both pictures fully visible (no crop). swap:true or mainSide end moves the main video to the other side. Or pass x/y/width/height as 0–1 of the frame. No spend.',
    inputSchema: z.object({
      preset: pipPresetIdSchema.optional(),
      mode: pipModeSchema.optional(),
      x: z.number().min(0).max(1).optional(),
      y: z.number().min(0).max(1).optional(),
      width: z.number().min(0.08).max(1).optional(),
      height: z.number().min(0.08).max(1).optional(),
      axis: pipAxisSchema.optional(),
      mainPct: z.number().min(0.2).max(0.8).optional(),
      mainSide: pipMainSideSchema.optional(),
      swap: z.boolean().optional(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'set_pip_layout', input, async () => {
        const layout = mergePipLayout(ctx.project.pipLayout, input)
        const { project } = await applyProjectMutation(ctx, (current) =>
          applyPipLayoutToProject(current, layout),
        )
        return toolOk(
          layout.mode === 'split'
            ? `Split layout (${layout.axis ?? 'horizontal'}, main ${Math.round((layout.mainPct ?? 0.5) * 100)}% on the ${(layout.mainSide ?? 'start') === 'start' ? 'left' : 'right'})`
            : `Overlay inset at ${Math.round(layout.x * 100)}%, ${Math.round(layout.y * 100)}%`,
          {
            pipLayout: project.pipLayout,
            revision: project.revision,
            presets: PIP_LAYOUT_PRESETS.map((row) => ({ id: row.id, label: row.label })),
          },
        )
      }),
  }),
})
