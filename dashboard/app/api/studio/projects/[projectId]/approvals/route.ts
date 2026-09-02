import { loadProject, RevisionConflictError } from '@synawood/creative/project'
import { collectApprovePreflight } from '@synawood/creative/review/preflight'
import {
  listApprovalEvents,
  overrideApproval,
  previewGovernance,
  rejectApproval,
  submitOrSignOffApproval,
  syncGovernancePolicyFromFile,
  type ProductRoleName,
} from '@synawood/creative/governance'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({
  action: z.enum(['sign_off', 'override', 'reject', 'sync_policy']),
  expectedRevision: z.number().int().positive().optional(),
  reason: z.string().max(2000).optional(),
})

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { project } = await loadProject(access.supabase, projectId)
    const preview = await previewGovernance(access.supabase, {
      project,
      actorRole: access.membership.role as ProductRoleName,
    })
    const events = preview.run ? await listApprovalEvents(access.supabase, preview.run.id) : []
    return Response.json({
      ...preview,
      events,
      projectRevision: project.revision,
      structureBeatCount: project.creativeStructure?.beats.length ?? 0,
      sceneCount: project.scenes.length,
      preflight: await collectApprovePreflight(access.supabase, project),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load governance state')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({
      projectId,
      minRole: body.action === 'override' ? 'owner' : 'editor',
    })
    const { supabase, blobEnv } = access
    const { project, row } = await loadProject(supabase, projectId)
    const actorRole = access.membership.role as ProductRoleName
    const attribution = {
      parentProjectId: row.parent_project_id,
      variantSpec: row.variant_spec,
    }

    if (body.action === 'sync_policy') {
      const policy = await syncGovernancePolicyFromFile(supabase, {
        productId: project.productId,
      })
      return Response.json({ policy })
    }

    if (body.expectedRevision == null) {
      return jsonError('expectedRevision is required', 400)
    }

    if (body.action === 'sign_off') {
      const result = await submitOrSignOffApproval({
        supabase,
        blobEnv,
        project,
        expectedRevision: body.expectedRevision,
        actorUserId: access.userId,
        actorRole,
        reason: body.reason,
        attribution,
      })
      return Response.json(result)
    }

    if (body.action === 'override') {
      const result = await overrideApproval({
        supabase,
        blobEnv,
        project,
        expectedRevision: body.expectedRevision,
        actorUserId: access.userId,
        actorRole,
        reason: body.reason ?? '',
        attribution,
      })
      return Response.json(result)
    }

    const result = await rejectApproval({
      supabase,
      project,
      expectedRevision: body.expectedRevision,
      actorUserId: access.userId,
      actorRole,
      reason: body.reason ?? '',
    })
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Approval action failed', (err) => {
      if (err instanceof RevisionConflictError) {
        return jsonError(err.message, 409)
      }
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      if (err instanceof Error && /blocked|requires|override|Rejection|Stage/i.test(err.message)) {
        return jsonError(err.message, 400)
      }
      return null
    })
  }
}
