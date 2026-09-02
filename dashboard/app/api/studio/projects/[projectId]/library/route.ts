import { createLibraryItem } from '@synawood/creative/library/create'
import { listLibrary } from '@synawood/creative/library/list'
import { libraryKindSchema } from '@synawood/creative/library'
import { loadProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { mapStudioRouteError } from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z
  .object({
    kind: libraryKindSchema.optional(),
  })
  .strict()

const createBodySchema = z
  .object({
    kind: libraryKindSchema,
    label: z.string().trim().min(1).max(80),
    prompt: z.string().trim().min(1).max(500).optional(),
    recipe: z.record(z.string(), z.unknown()).optional(),
    confirmSpend: z.boolean().optional(),
    createdBy: z.enum(['user', 'agent']).default('user'),
  })
  .strict()

/** GET first-party packs + product library rows. POST create_library_item (#716). */
export const GET = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const url = new URL(request.url)
    const query = querySchema.parse({
      kind: url.searchParams.get('kind') || undefined,
    })
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { project } = await loadProject(access.supabase, projectId)
    const items = await listLibrary({
      supabase: access.supabase,
      productId: access.productId,
      kind: query.kind,
    })
    return Response.json({
      items,
      projectId,
      productId: access.productId,
      revision: project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not list library.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = createBodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { project, row } = await loadProject(access.supabase, projectId)
    const item = await createLibraryItem(
      {
        productId: access.productId,
        projectId,
        project,
        blobEnv: access.blobEnv,
        modelProfileId: row.model_profile_id,
        persist: true,
        supabase: access.supabase,
        confirmSpend: body.confirmSpend,
      },
      {
        kind: body.kind,
        label: body.label,
        prompt: body.prompt,
        recipe: body.recipe,
        confirmSpend: body.confirmSpend,
        createdBy: body.createdBy,
      },
    )
    return Response.json({ item, projectId, productId: access.productId })
  } catch (error) {
    return handleRouteError(error, 'Could not create library item.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
