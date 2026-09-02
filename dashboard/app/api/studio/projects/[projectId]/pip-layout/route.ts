import { loadProject } from '@synawood/creative/project'
import {
  mergePipLayout,
  PIP_LAYOUT_PRESETS,
  pipAxisSchema,
  pipMainSideSchema,
  pipModeSchema,
  pipPresetIdSchema,
} from '@synawood/creative/project/pip-layout'
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
  })
  .strict()

/** GET current layout + presets. POST set_pip_layout. */
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
      pipLayout: mergePipLayout(project.pipLayout, {}),
      presets: PIP_LAYOUT_PRESETS.map((row) => ({
        id: row.id,
        label: row.label,
        hint: row.hint,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load picture layout.')
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
    const { expectedRevision, ...patch } = body
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      expectedRevision,
      'set_pip_layout',
      patch,
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to set picture layout', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
