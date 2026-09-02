import { STUDIO_TOOL_NAMES, type StudioToolName } from '@synawood/creative/tools'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import {
  jsonFromToolOutcome,
  mapStudioRouteError,
  runStudioProjectTool,
} from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Tools contextual suggestions are allowed to invoke via Apply. */
const SUGGESTION_APPLY_TOOLS = new Set<StudioToolName>([
  'trim_clip',
  'split_clip',
  'pack_clips',
  'add_captions',
  'set_end_card',
  'assign_clip_to_scene',
  'place_clip',
  'place_overlay',
  'remove_overlay',
  'set_hook_title',
  'fit_duration',
  'generate_image',
  'generate_voiceover',
  'generate_video_clip',
  'assemble_broll',
])

const toolNameSchema = z
  .string()
  .min(1)
  .refine(
    (name): name is StudioToolName => (STUDIO_TOOL_NAMES as readonly string[]).includes(name),
    {
      message: 'Unknown Studio tool',
    },
  )

const bodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    tool: toolNameSchema,
    args: z.record(z.string(), z.unknown()).default({}),
    confirmSpend: z.boolean().optional(),
  })
  .strict()

/** POST — apply one contextual suggestion by running its Studio tool. */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    if (!SUGGESTION_APPLY_TOOLS.has(body.tool)) {
      return jsonError(`Tool ${body.tool} cannot be applied from contextual suggestions`, 400)
    }
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const input =
      body.confirmSpend === undefined
        ? body.args
        : { ...body.args, confirmSpend: body.confirmSpend }
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      body.expectedRevision,
      body.tool,
      input,
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to apply suggestion', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
