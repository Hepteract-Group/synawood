export type PostizUploadedMedia = {
  id: string
  path: string
}

export type ReadFinalBytes = (blobKey: string) => Promise<Buffer | Uint8Array>

type PostizUploadAuth = {
  baseUrl: string
  apiKey: string
  fetchImpl?: typeof fetch
}

const joinUploadUrl = (baseUrl: string): string => `${baseUrl.trim().replace(/\/+$/, '')}/upload`

const parseUploadedMedia = (body: unknown): PostizUploadedMedia => {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    !('path' in body) ||
    typeof body.id !== 'string' ||
    typeof body.path !== 'string' ||
    body.id.length === 0 ||
    body.path.length === 0
  ) {
    throw new Error('Postiz multipart upload returned no id/path.')
  }
  return { id: body.id, path: body.path }
}

export const uploadPostizMedia = async (
  input: {
    bytes: Buffer | Uint8Array
    filename: string
    contentType: string
  } & PostizUploadAuth,
): Promise<PostizUploadedMedia> => {
  const fetchImpl = input.fetchImpl ?? fetch
  const form = new FormData()
  // Copy into a real ArrayBuffer so File() typechecks and we don't share a pooled Node Buffer.
  const fileBytes = new Uint8Array(input.bytes.byteLength)
  fileBytes.set(input.bytes)
  form.append('file', new File([fileBytes], input.filename, { type: input.contentType }))

  const response = await fetchImpl(joinUploadUrl(input.baseUrl), {
    method: 'POST',
    headers: { Authorization: input.apiKey },
    body: form,
  })

  if (!response.ok) {
    throw new Error(
      `Postiz multipart upload failed (${response.status}). Do not base64-inline media.`,
    )
  }

  return parseUploadedMedia(await response.json())
}

/** Callers pass `getBlobBytes` from `@synawood/creative` — this package does not import Azure. */
export const uploadFinalBlobToPostiz = async (
  input: {
    blobKey: string
    filename: string
    contentType: string
    readBytes: ReadFinalBytes
  } & PostizUploadAuth,
): Promise<PostizUploadedMedia> => {
  const bytes = await input.readBytes(input.blobKey)
  const { baseUrl, apiKey, fetchImpl } = input
  return uploadPostizMedia({
    bytes,
    filename: input.filename,
    contentType: input.contentType,
    baseUrl,
    apiKey,
    fetchImpl,
  })
}
