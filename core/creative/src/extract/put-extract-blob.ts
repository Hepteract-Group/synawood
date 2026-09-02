import { putBlob, type BlobEnv } from '../persistence/blob'
import type { ProductExtractKind } from './product-extract-schema'

const extForContentType = (contentType: string): string => {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/svg+xml') return 'svg'
  return 'bin'
}

/** Persist extract still/screenshot bytes under marketing-os/{productId}/extract/… */
export const putExtractBlob = async (input: {
  blobEnv: BlobEnv
  productId: string
  extractId: string
  kind: Extract<ProductExtractKind, 'screenshot' | 'still'>
  data: Buffer | Uint8Array
  contentType: string
  filename?: string
}): Promise<{ blobKey: string }> => {
  const ext = input.filename?.includes('.')
    ? input.filename.split('.').pop()!
    : extForContentType(input.contentType)
  const name = input.filename ?? `${input.kind}.${ext}`
  return putBlob({
    blobEnv: input.blobEnv,
    productId: input.productId,
    kind: 'extract',
    parts: [input.extractId, name],
    data: input.data,
    contentType: input.contentType,
  })
}
