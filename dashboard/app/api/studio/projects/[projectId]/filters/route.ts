import { listStylePacks } from '@synawood/creative/effects'
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

const bodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    clipId: z.string().min(1).optional(),
    filterId: z.string().min(1).max(80).nullable(),
    intensity: z.number().min(0).max(1).optional(),
  })
  .strict()

/** GET packs + cut/clip grades. POST apply_filter (omit clipId for the cut). */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { project } = await loadProject(access.supabase, projectId)
    return Response.json({
      packs: listStylePacks().map((pack) => ({
        id: pack.id,
        label: pack.label,
        license: pack.license,
      })),
      projectId,
      stylePackId: project.stylePackId ?? null,
      clips: project.clips.map((clip) => ({
        clipId: clip.id,
        filterId: clip.filterId ?? null,
        filterIntensity: clip.filterIntensity ?? null,
      })),
      revision: project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not list filters.')
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
    const { expectedRevision, ...input } = body
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      expectedRevision,
      'apply_filter',
      input,
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to apply filter', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
