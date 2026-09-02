import type { SupabaseClient } from '@supabase/supabase-js'
import {
  productExtractFromRow,
  productExtractSelect,
  type ProductExtract,
  type ProductExtractRow,
} from './product-extract-schema'

export const getProductExtract = async (input: {
  supabase: SupabaseClient
  productId: string
  extractId: string
}): Promise<ProductExtract | null> => {
  const { data, error } = await input.supabase
    .from('product_extracts')
    .select(productExtractSelect())
    .eq('product_id', input.productId)
    .eq('id', input.extractId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load product extract: ${error.message}`)
  }
  if (!data) return null
  return productExtractFromRow(data as unknown as ProductExtractRow)
}
