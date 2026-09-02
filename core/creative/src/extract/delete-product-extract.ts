import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteBlob, type BlobEnv } from '../persistence/blob'
import { getProductExtract } from './get-product-extract'

const DELETE_EXTRACT_CODE = 'delete_extract'

export const isDeleteExtractError = (
  error: unknown,
): error is Error & { status: number; code: typeof DELETE_EXTRACT_CODE } =>
  error instanceof Error && (error as { code?: unknown }).code === DELETE_EXTRACT_CODE

const fail = (message: string, status: 404 | 500): Error & { status: number; code: string } => {
  const error = new Error(message) as Error & { status: number; code: string }
  error.status = status
  error.code = DELETE_EXTRACT_CODE
  return error
}

/**
 * Remove a Product Extract for every Studio Project on that Product.
 * Deletes the row first so the bin cannot show a still whose blob is already gone.
 * Blob delete is best-effort.
 */
export const deleteProductExtract = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  extractId: string
}): Promise<{ extractId: string }> => {
  const extract = await getProductExtract({
    supabase: input.supabase,
    productId: input.productId,
    extractId: input.extractId,
  })
  if (!extract) {
    throw fail('Extract not found', 404)
  }

  const { error } = await input.supabase
    .from('product_extracts')
    .delete()
    .eq('product_id', input.productId)
    .eq('id', input.extractId)

  if (error) {
    throw fail(`Failed to delete product extract: ${error.message}`, 500)
  }

  if (extract.blobKey) {
    await deleteBlob({ blobEnv: input.blobEnv, blobKey: extract.blobKey }).catch((blobError) => {
      console.warn(
        `[delete-product-extract] Blob leftover for ${extract.blobKey}:`,
        blobError instanceof Error ? blobError.message : blobError,
      )
    })
  }

  return { extractId: extract.id }
}
