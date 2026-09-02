import { createSignedBlobUrl } from '@synawood/creative'
import {
  ingestProjectAssetFromUrl,
  RevisionConflictError,
  UrlAssetIngestError,
} from '@synawood/creative/project'
import { UnsafeUrlError } from '@synawood/creative/extract/ssrf'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    projectId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    url: z.string().trim().min(1).max(2000),
    addAsClip: z.boolean().optional(),
  })
  .strict()

/** POST — Add from URL (#108). Fetches image SSRF-safe; stores Blob bytes with source=url. */
export const POST = async (request: Request) => {
  try {
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({
      projectId: body.projectId,
      minRole: 'editor',
    })
    const result = await ingestProjectAssetFromUrl({
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      projectId: body.projectId,
      expectedRevision: body.expectedRevision,
      url: body.url,
      addAsClip: body.addAsClip ?? false,
    })
    return Response.json(
      {
        asset: {
          ...result.asset,
          signedUrl: createSignedBlobUrl({
            blobEnv: access.blobEnv,
            blobKey: result.asset.blobKey,
            expiresInSeconds: 60 * 60,
          }),
        },
        project: result.project,
        finalUrl: result.finalUrl,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError(error, 'Add from URL failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      if (err instanceof RevisionConflictError || /revision conflict/i.test(String(err))) {
        return jsonError(err instanceof Error ? err.message : 'Revision conflict', 409)
      }
      if (err instanceof UrlAssetIngestError || err instanceof UnsafeUrlError) {
        return jsonError(err.message, 400)
      }
      return null
    })
  }
}
