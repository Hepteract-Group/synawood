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

const fromTranscriptSchema = z
  .object({
    action: z.literal('from_transcript'),
    expectedRevision: z.number().int().positive(),
    clipId: z.string().min(1),
    confirmSpend: z.boolean().optional(),
  })
  .strict()

const typeLineSchema = z
  .object({
    action: z.literal('type_line'),
    expectedRevision: z.number().int().positive(),
    text: z.string().min(1).max(400),
    from: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
  })
  .strict()

const bodySchema = z.discriminatedUnion('action', [fromTranscriptSchema, typeLineSchema])

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
      captions: project.overlays.filter((overlay) => overlay.kind === 'caption'),
      revision: project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not list captions.')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    if (body.action === 'from_transcript') {
      const { outcome, project, traceWarning } = await runStudioProjectTool(
        access,
        projectId,
        body.expectedRevision,
        'captions_from_transcript',
        { clipId: body.clipId, confirmSpend: body.confirmSpend },
      )
      return jsonFromToolOutcome(outcome, { project, traceWarning })
    }
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      body.expectedRevision,
      'add_captions',
      {
        text: body.text,
        from: body.from,
        durationInFrames: body.durationInFrames,
      },
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Caption mutation failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
