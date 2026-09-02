import { loadLatestDraftBrollPlan } from '@synawood/creative/broll'
import { parseBrollAssembleBody } from '@synawood/creative/broll/http'
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

const markStaleIfNeeded = <T extends { status: string; projectRevision: number }>(
  plan: T,
  projectRevision: number,
): T => {
  if (plan.status !== 'draft') return plan
  if (plan.projectRevision === projectRevision) return plan
  return { ...plan, status: 'stale' }
}

/** GET — latest draft overlay plan (survives reload). */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { project } = await loadProject(access.supabase, projectId)
    const loaded = await loadLatestDraftBrollPlan(access.supabase, projectId)
    const mirrored = project.brollPlan
    const mirroredLive =
      mirrored && (mirrored.status === 'draft' || mirrored.status === 'stale') ? mirrored : null
    let plan = loaded?.plan ?? mirroredLive
    if (plan) {
      plan = markStaleIfNeeded(plan, project.revision)
    }
    return Response.json({
      plan,
      revision: project.revision,
      source: loaded ? 'broll_plans' : plan ? 'project' : null,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load overlay plan')
  }
}

/** POST — assemble_broll (preview-first; dryRun defaults true). */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = parseBrollAssembleBody(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { expectedRevision, ...input } = body
    if (input.dryRun === undefined) {
      input.dryRun = true
    }
    const { outcome, project, traceWarning } = await runStudioProjectTool(
      access,
      projectId,
      expectedRevision,
      'assemble_broll',
      input,
    )
    return jsonFromToolOutcome(outcome, { project, traceWarning })
  } catch (error) {
    return handleRouteError(error, 'Failed to assemble overlay plan', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
