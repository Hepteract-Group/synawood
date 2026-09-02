import { importLibraryItem } from '@synawood/creative/library/import'
import { libraryKindSchema } from '@synawood/creative/library'
import { loadProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { mapStudioRouteError } from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    fileName: z.string().trim().min(1).max(180),
    contentType: z.string().trim().min(1).max(80).optional(),
    jsonText: z.string().min(2).max(20_000).optional(),
    bytesBase64: z.string().min(8).max(2_000_000).optional(),
    label: z.string().trim().min(1).max(80).optional(),
    kind: libraryKindSchema.optional(),
  })
  .strict()

/** POST import a sticker file or JSON recipe. Errors are meant for the bin, not the console. */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    await loadProject(access.supabase, projectId)
    const bytes = body.jsonText
      ? Buffer.from(body.jsonText, 'utf8')
      : body.bytesBase64
        ? Buffer.from(body.bytesBase64, 'base64')
        : null
    if (!bytes) {
      return jsonError('Pass jsonText for a recipe or bytesBase64 for a sticker file.', 400)
    }
    const item = await importLibraryItem(
      {
        productId: access.productId,
        blobEnv: access.blobEnv,
        persist: true,
        supabase: access.supabase,
      },
      {
        fileName: body.fileName,
        contentType: body.contentType ?? 'application/octet-stream',
        bytes,
        label: body.label,
        kind: body.kind,
        createdBy: 'import',
      },
    )
    return Response.json({ item, projectId, productId: access.productId })
  } catch (error) {
    return handleRouteError(error, 'Could not import library file.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
