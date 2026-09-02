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

const postSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    action: z.enum(['derive', 'set']),
    beats: z
      .array(
        z
          .object({
            kind: z.enum(['hook', 'education', 'trust', 'offer', 'cta']),
            from: z.number().int().nonnegative(),
            durationInFrames: z.number().int().positive(),
            sceneId: z.string().min(1).max(64).optional(),
          })
          .strict(),
      )
      .max(24)
      .optional(),
  })
  .strict()

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { project } = await loadProject(access.supabase, projectId)
    return Response.json({
      creativeStructure: project.creativeStructure,
      revision: project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load creative structure')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = postSchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    if (body.action === 'set') {
      const { outcome, project, traceWarning } = await runStudioProjectTool(
        access,
        projectId,
        body.expectedRevision,
        'set_creative_structure',
        { beats: body.beats ?? [] },
      )
      return jsonFromToolOutcome(outcome, { project, traceWarning })
    }
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      body.expectedRevision,
      'derive_creative_structure',
      {},
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to update creative structure', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
