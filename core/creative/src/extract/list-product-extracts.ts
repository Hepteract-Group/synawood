import type { SupabaseClient } from '@supabase/supabase-js'
import {
  productExtractFromRow,
  productExtractSelect,
  type ProductExtract,
  type ProductExtractQuality,
  type ProductExtractRow,
} from './product-extract-schema'

export const listProductExtracts = async (input: {
  supabase: SupabaseClient
  productId: string
  quality?: ProductExtractQuality | ProductExtractQuality[]
  jobId?: string
  limit?: number
}): Promise<ProductExtract[]> => {
  let query = input.supabase
    .from('product_extracts')
    .select(productExtractSelect())
    .eq('product_id', input.productId)
    .order('created_at', { ascending: false })

  if (input.quality != null) {
    const qualities = Array.isArray(input.quality) ? input.quality : [input.quality]
    query = query.in('quality', qualities)
  }
  if (input.jobId) {
    query = query.eq('job_id', input.jobId)
  }
  if (input.limit != null) {
    query = query.limit(input.limit)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list product extracts: ${error.message}`)
  }

  return (data ?? []).map((row) => productExtractFromRow(row as unknown as ProductExtractRow))
}
