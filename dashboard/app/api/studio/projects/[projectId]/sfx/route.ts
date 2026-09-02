import { listSfxPack } from '@synawood/creative/audio'
import { loadProject } from '@synawood/creative/project'
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
    packId: z.enum(['whoosh', 'hit']),
    from: z.number().int().nonnegative().optional(),
  })
  .strict()

/** GET first-party pack. POST place_sfx. */
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
      pack: listSfxPack().map((item) => ({
        id: item.id,
        label: item.label,
        license: item.license,
      })),
      revision: project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not list sounds.')
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
      'place_sfx',
      input,
    )
    return jsonFromToolOutcome(outcome, {
      project,
      traceWarning,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not place that sound', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
