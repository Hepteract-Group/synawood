import { createSignedBlobUrl } from '@synawood/creative'
import {
  applyStudioCraft,
  deleteProject,
  loadProject,
  renameProject,
  resolveHistoryMeta,
  RevisionConflictError,
  saveProject,
  seedCurrentRevision,
  summarizeProject,
  studioProjectSchema,
} from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const fullPatchBodySchema = z.object({
  expectedRevision: z.number().int().positive(),
  project: studioProjectSchema,
})

const renamePatchBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
})

const lightPatchBodySchema = z
  .object({
    turnMode: z.enum(['plan', 'ask', 'inspect', 'execute']).optional(),
    craft: z.enum(['footage', 'motion']).optional(),
  })
  .strict()
  .refine((value) => value.turnMode !== undefined || value.craft !== undefined)

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { supabase, blobEnv } = access
    const { project, row } = await loadProject(supabase, projectId)
    await seedCurrentRevision(supabase, row, project)
    const history = await resolveHistoryMeta(supabase, projectId, {
      revision: project.revision,
      history_tip: row.history_tip ?? project.revision,
    })
    const assets = project.assets.map((asset) => ({
      ...asset,
      signedUrl: createSignedBlobUrl({
        blobEnv,
        blobKey: asset.blobKey,
        expiresInSeconds: 60 * 60,
      }),
    }))
    return Response.json({
      project: { ...project, assets },
      summary: summarizeProject(project),
      history,
      row: {
        modelProfileId: row.model_profile_id,
        reasonerModelId: row.reasoner_model_id ?? null,
        videoModelId: row.video_model_id ?? null,
        parentProjectId: row.parent_project_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        historyTip: row.history_tip ?? project.revision,
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load project', (error) => {
      const message = error instanceof Error ? error.message : 'Failed to load project'
      if (message.includes('not found')) return jsonError(message, 404)
      return null
    })
  }
}

export const PATCH = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const raw = await request.json().catch(() => ({}))
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access

    const renameOnly = renamePatchBodySchema.safeParse(raw)
    const lightPatch = lightPatchBodySchema.safeParse(raw)
    const isFullPatch =
      raw && typeof raw === 'object' && 'expectedRevision' in raw && 'project' in raw

    if (!isFullPatch && renameOnly.success) {
      const { project } = await renameProject(supabase, projectId, renameOnly.data.name)
      return Response.json({ project, summary: summarizeProject(project) })
    }

    if (!isFullPatch && lightPatch.success) {
      const { project: loaded } = await loadProject(supabase, projectId)
      let next = loaded
      if (lightPatch.data.turnMode) {
        next = { ...next, turnMode: lightPatch.data.turnMode }
      }
      if (lightPatch.data.craft) {
        next = applyStudioCraft(next, lightPatch.data.craft)
      }
      const { project } = await saveProject(supabase, next, loaded.revision)
      return Response.json({ project, summary: summarizeProject(project) })
    }

    const body = fullPatchBodySchema.parse(raw)
    if (body.project.id !== projectId) {
      return jsonError('Project id in body must match URL', 400)
    }
    const { project } = await saveProject(supabase, body.project, body.expectedRevision)
    return Response.json({ project, summary: summarizeProject(project) })
  } catch (error) {
    return handleRouteError(error, 'Failed to save project', (error) => {
      if (error instanceof RevisionConflictError) {
        return jsonError(error.message, 409)
      }
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      const message = error instanceof Error ? error.message : ''
      if (message.includes('not found')) return jsonError(message, 404)
      if (message.includes('name')) return jsonError(message, 400)
      return null
    })
  }
}

export const DELETE = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    await deleteProject(access.supabase, projectId)
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error, 'Failed to delete project', (error) => {
      const message = error instanceof Error ? error.message : 'Failed to delete project'
      if (message.includes('not found')) return jsonError(message, 404)
      return null
    })
  }
}
