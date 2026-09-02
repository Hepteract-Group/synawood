import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteBlob, putBlob, type BlobEnv } from '../persistence/blob'
import type { ProjectAsset } from '../project/schema'

export const persistExtractScreenshotAsset = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
  png: Buffer
  sourceUrl: string
}): Promise<ProjectAsset> => {
  const assetId = randomUUID()
  const { blobKey } = await putBlob({
    blobEnv: input.blobEnv,
    productId: input.productId,
    kind: 'brand-kit',
    parts: [input.projectId, 'extract', `${assetId}-screenshot.png`],
    data: input.png,
    contentType: 'image/png',
  })
  const { error } = await input.supabase.from('assets').insert({
    id: assetId,
    product_id: input.productId,
    project_id: input.projectId,
    kind: 'image',
    source: 'upload',
    blob_key: blobKey,
    content_type: 'image/png',
    probe: { extract: true, role: 'screenshot', sourceUrl: input.sourceUrl },
  })
  if (error) {
    try {
      await deleteBlob({ blobEnv: input.blobEnv, blobKey })
    } catch {
      /* best effort */
    }
    throw new Error(`Failed to register extract screenshot: ${error.message}`)
  }
  return {
    id: assetId,
    kind: 'image',
    blobKey,
    contentType: 'image/png',
    source: 'upload',
    probe: { extract: true, role: 'screenshot', sourceUrl: input.sourceUrl },
  }
}
