import { listFirstPartyStickers } from '@synawood/creative/overlays'
import { loadProject, overlayLayoutSchema } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import {
  jsonFromToolOutcome,
  mapStudioRouteError,
  runStudioProjectTool,
} from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const placeBodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    stickerId: z.string().min(1),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
    layout: overlayLayoutSchema.optional(),
  })
  .strict()

/** GET first-party pack. POST place_sticker. */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { project } = await loadProject(access.supabase, projectId)
    return Response.json({
      projectId,
      stickers: listFirstPartyStickers().map((sticker) => ({
        id: sticker.id,
        label: sticker.label,
        license: sticker.license,
      })),
      overlays: project.overlays.filter((overlay) => overlay.kind === 'sticker'),
      revision: project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not list stickers.')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = placeBodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { expectedRevision, ...input } = body
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      expectedRevision,
      'place_sticker',
      input,
    )
    return jsonFromToolOutcome(outcome, {
      project,
      overlays: project.overlays.filter((overlay) => overlay.kind === 'sticker'),
      traceWarning,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not place sticker', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
