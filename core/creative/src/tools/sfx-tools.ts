/** First-party sounds + motion pack tools (ADR-0073 / #885). */

import { tool } from 'ai'
import { z } from 'zod'
import { encodeSfxWav } from '../audio/sfx-wav'
import { isSfxPackId } from '../audio/sfx-catalog'
import { placeSfx } from '../audio/place-sfx'
import { applyMotionPreset, isMotionPresetId } from '../effects/motion-presets'
import { putBlob } from '../persistence/blob'
import { isToolEnabled } from '../model-profiles'
import { applyProjectMutation, wrapTool } from './store'
import type { StudioToolContext } from './types'
import { toolFail, toolOk } from './types'

const ensureEnabled = (ctx: StudioToolContext, name: string) => {
  if (!isToolEnabled(ctx.modelProfileId, name)) {
    return toolFail(`Tool ${name} is disabled on profile ${ctx.modelProfileId}.`)
  }
  return null
}

export const createSfxStudioTools = (ctx: StudioToolContext) => ({
  place_sfx: tool({
    description:
      'Place a first-party whoosh or hit on the Sounds lane (not the music bed). Whoosh for the hook, hit for the call to action. No spend. Not stock GIFs.',
    inputSchema: z.object({
      packId: z.enum(['whoosh', 'hit']),
      from: z.number().int().nonnegative(),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'place_sfx', input, async () => {
        const disabled = ensureEnabled(ctx, 'place_sfx')
        if (disabled) return disabled
        if (!isSfxPackId(input.packId)) {
          return toolFail('Pick whoosh or hit.')
        }
        let blobKey: string | undefined
        if (ctx.persist) {
          const wav = encodeSfxWav(input.packId)
          const put = await putBlob({
            blobEnv: ctx.blobEnv,
            productId: ctx.productId,
            kind: 'uploads',
            parts: [ctx.projectId, `sfx-${input.packId}.wav`],
            data: wav,
            contentType: 'audio/wav',
          })
          blobKey = put.blobKey
        } else {
          blobKey = `local/marketing-os/${ctx.productId}/sfx/${input.packId}.wav`
        }
        try {
          const { project } = await applyProjectMutation(ctx, (current) =>
            placeSfx(current, { packId: input.packId, from: input.from, blobKey }),
          )
          const clip = project.clips
            .filter((item) => {
              const asset = project.assets.find((entry) => entry.id === item.assetId)
              return asset?.probe?.packId === input.packId
            })
            .at(-1)
          return toolOk(
            input.packId === 'whoosh' ? 'Added a whoosh.' : 'Added a hit on the call to action.',
            { clipId: clip?.id, revision: project.revision },
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not place that sound.'
          if (/overlap/i.test(message)) {
            return toolFail('There is already a sound there. Move it or pick another time.')
          }
          return toolFail(message)
        }
      }),
  }),

  apply_motion_preset: tool({
    description:
      'Apply a first-party punch on a clip: hook_punch (zoom + flash) or cta_hit (shake + flash). Uses existing treatments. No new effects. No spend.',
    inputSchema: z.object({
      clipId: z.string().min(1),
      presetId: z.enum(['hook_punch', 'cta_hit']),
    }),
    execute: async (input) =>
      wrapTool(ctx, 'apply_motion_preset', input, async () => {
        const disabled = ensureEnabled(ctx, 'apply_motion_preset')
        if (disabled) return disabled
        if (!isMotionPresetId(input.presetId)) {
          return toolFail('Pick hook punch or call to action from the motion pack.')
        }
        const { project } = await applyProjectMutation(ctx, (current) =>
          applyMotionPreset(current, { clipId: input.clipId, presetId: input.presetId }),
        )
        const clip = project.clips.find((item) => item.id === input.clipId)
        return toolOk(
          input.presetId === 'hook_punch'
            ? 'Added a punch on the hook.'
            : 'Added a punch on the call to action.',
          { clipId: input.clipId, treatments: clip?.treatments ?? [], revision: project.revision },
        )
      }),
  }),
})
