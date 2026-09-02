import { intentSchema } from '@synawood/creative/intent'
import { loadLatestDraftDirectorPlan, markPlanStaleIfNeeded } from '@synawood/creative/director'
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
    style: z.string().min(1).max(80).optional(),
    intentOverrides: intentSchema.partial().optional(),
    scope: z
      .union([
        z.literal('global'),
        z.object({ sceneIds: z.array(z.string().min(1)).min(1) }).strict(),
        z.object({ clipIds: z.array(z.string().min(1)).min(1) }).strict(),
      ])
      .optional(),
    /** Defaults true — never mutates timeline until /director/commit. */
    dryRun: z.boolean().optional(),
    maxCostGbp: z.number().nonnegative().optional(),
    refinement: z
      .object({
        priorPlanId: z.string().uuid(),
        note: z.string().min(1).max(400),
      })
      .strict()
      .optional(),
  })
  .strict()

/** GET — latest draft DirectorPlan (survives reload). */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { project } = await loadProject(access.supabase, projectId)
    const loaded = await loadLatestDraftDirectorPlan(access.supabase, projectId)
    let plan = loaded?.plan ?? project.directorPlan ?? null
    if (plan) {
      plan = markPlanStaleIfNeeded(plan, project.revision)
    }
    return Response.json({
      plan,
      revision: project.revision,
      source: loaded ? 'director_plans' : plan ? 'project' : null,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load director plan')
  }
}

/** POST — direct_project (preview-first; dryRun defaults true). */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = postSchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { expectedRevision, ...input } = body
    if (input.dryRun === undefined) {
      input.dryRun = true
    }
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      expectedRevision,
      'direct_project',
      input,
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to run Director', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
