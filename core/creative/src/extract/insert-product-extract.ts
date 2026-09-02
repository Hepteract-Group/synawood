import type { SupabaseClient } from '@supabase/supabase-js'
import { assertOwnedBlobKey } from './assert-blob-key'
import {
  productExtractFromRow,
  productExtractSelect,
  type ProductExtract,
  type ProductExtractKind,
  type ProductExtractQuality,
  type ProductExtractRow,
} from './product-extract-schema'

const validateInsertShape = (input: {
  kind: ProductExtractKind
  blobKey?: string | null
  text?: string | null
}): void => {
  if (input.kind === 'text') {
    if (!input.text?.trim()) {
      throw new Error('Text extracts require non-empty text')
    }
    return
  }
  if (!input.blobKey?.trim()) {
    throw new Error(`${input.kind} extracts require a blob key`)
  }
  assertOwnedBlobKey(input.blobKey)
}

export const insertProductExtract = async (input: {
  supabase: SupabaseClient
  productId: string
  kind: ProductExtractKind
  sourceUrl: string
  blobKey?: string | null
  text?: string | null
  quality?: ProductExtractQuality
  qualityNote?: string | null
  jobId?: string | null
  id?: string
}): Promise<ProductExtract> => {
  validateInsertShape(input)

  const row = {
    ...(input.id ? { id: input.id } : {}),
    product_id: input.productId,
    kind: input.kind,
    source_url: input.sourceUrl,
    blob_key: input.kind === 'text' ? null : (input.blobKey ?? null),
    text: input.kind === 'text' ? (input.text ?? null) : null,
    quality: input.quality ?? 'usable',
    quality_note: input.qualityNote ?? null,
    job_id: input.jobId ?? null,
  }

  const { data, error } = await input.supabase
    .from('product_extracts')
    .insert(row)
    .select(productExtractSelect())
    .single()

  if (error || !data) {
    throw new Error(`Failed to insert product extract: ${error?.message ?? 'no row'}`)
  }

  return productExtractFromRow(data as unknown as ProductExtractRow)
}
