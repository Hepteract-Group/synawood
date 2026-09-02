import { createSignedBlobUrl } from '@synawood/creative'
import { RevisionConflictError, uploadProjectAsset } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { STUDIO_UPLOAD_MAX_LABEL } from '@/lib/studio-upload-limits'

export const POST = async (request: Request) => {
  try {
    let form: FormData
    try {
      form = await request.formData()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/FormData|boundary|body/i.test(message)) {
        return jsonError(
          `Upload could not be read as a file. Use a media file under ${STUDIO_UPLOAD_MAX_LABEL}, then retry after refreshing Studio.`,
          413,
        )
      }
      throw error
    }
    const projectId = String(form.get('projectId') ?? '')
    const expectedRevisionRaw = String(form.get('expectedRevision') ?? '')
    const expectedRevision = Number(expectedRevisionRaw)
    const file = form.get('file')

    if (!projectId) {
      return jsonError('projectId is required')
    }
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      return jsonError('expectedRevision must be a positive integer')
    }
    if (!(file instanceof File)) {
      return jsonError('file is required')
    }

    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase, blobEnv } = access
    const data = Buffer.from(await file.arrayBuffer())
    const result = await uploadProjectAsset({
      supabase,
      blobEnv,
      projectId,
      expectedRevision,
      fileName: file.name || 'upload.bin',
      contentType: file.type || 'application/octet-stream',
      data,
      addAsClip: form.get('addAsClip') !== 'false',
    })

    return Response.json(
      {
        asset: {
          ...result.asset,
          signedUrl: createSignedBlobUrl({
            blobEnv,
            blobKey: result.asset.blobKey,
            expiresInSeconds: 60 * 60,
          }),
        },
        project: result.project,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError(error, 'Upload failed', (error) => {
      if (error instanceof RevisionConflictError) {
        return jsonError(error.message, 409)
      }
      const message = error instanceof Error ? error.message : 'Upload failed'
      if (/revision conflict/i.test(message)) return jsonError(message, 409)
      return null
    })
  }
}
