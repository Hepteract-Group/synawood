import {
  loadProject,
  renameProject,
  RevisionConflictError,
  saveProject,
  studioProjectSchema,
  summarizeProject,
  type StudioProject,
} from '@synawood/creative/project'
import { z } from 'zod'
import { ProductAccessError } from './product-membership'
import type { ApiKeyAccess } from './with-api-key'

export const fullPatchBodySchema = z.object({
  expectedRevision: z.number().int().positive(),
  project: studioProjectSchema,
})

export const renamePatchBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export const assertApiKeyOwnsProject = (keyProductId: string, projectProductId: string): void => {
  if (keyProductId !== projectProductId) {
    throw new ProductAccessError('API key does not belong to this product.', 403)
  }
}

/** GET body maps 1:1 to first-party `get_project_summary` plus the project for PATCH. */
export const v1ProjectReadBody = (project: StudioProject) => {
  const summary = summarizeProject(project)
  return {
    tool: 'get_project_summary' as const,
    summary,
    clipIds: project.clips.map((clip) => clip.id),
    assetIds: project.assets.map((asset) => asset.id),
    overlays: summary.overlays,
    project,
  }
}

export const loadV1ProjectForKey = async (access: ApiKeyAccess, projectId: string) => {
  const { project, row } = await loadProject(access.supabase, projectId)
  assertApiKeyOwnsProject(access.productId, project.productId)
  return { project, row }
}

export const patchV1Project = async (
  access: ApiKeyAccess,
  projectId: string,
  raw: unknown,
): Promise<{ project: StudioProject; summary: ReturnType<typeof summarizeProject> }> => {
  await loadV1ProjectForKey(access, projectId)

  const renameOnly = renamePatchBodySchema.safeParse(raw)
  const isFullPatch =
    raw && typeof raw === 'object' && 'expectedRevision' in raw && 'project' in raw

  if (!isFullPatch && renameOnly.success) {
    const { project } = await renameProject(access.supabase, projectId, renameOnly.data.name)
    return { project, summary: summarizeProject(project) }
  }

  const body = fullPatchBodySchema.parse(raw)
  if (body.project.id !== projectId) {
    throw new Error('Project id in body must match URL')
  }
  assertApiKeyOwnsProject(access.productId, body.project.productId)
  const { project } = await saveProject(access.supabase, body.project, body.expectedRevision)
  return { project, summary: summarizeProject(project) }
}

export { RevisionConflictError }
