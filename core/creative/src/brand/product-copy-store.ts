/** Postgres cache for Brand DNA / Catalog (ADR-0044). */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BrandDna } from './dna'
import { parseBrandDna } from './dna'
import type { ProductCatalog } from './catalog'
import { parseProductCatalog } from './catalog'
import {
  loadBrandDna,
  loadProductCatalog,
  writeCatalogFileBestEffort,
  writeDnaFileBestEffort,
} from './product-copy'

export type BrandDnaDraft = {
  draft: BrandDna
  sourceUrl: string
}

export const loadProductBrandDna = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<{ dna: BrandDna; source: 'cache' | 'file' | 'empty'; draft: BrandDnaDraft | null }> => {
  const { data, error } = await supabase
    .from('products')
    .select('brand_dna, brand_dna_draft, brand_dna_draft_url')
    .eq('id', productId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load Brand DNA: ${error.message}`)
  }
  const loaded = await loadBrandDna({ productId, cache: data?.brand_dna ?? null })
  const draftRaw = data?.brand_dna_draft
  const draftUrl = typeof data?.brand_dna_draft_url === 'string' ? data.brand_dna_draft_url : ''
  const draft =
    draftRaw != null && draftUrl
      ? { draft: parseBrandDna(draftRaw, productId), sourceUrl: draftUrl }
      : null
  return { ...loaded, draft }
}

export const saveProductBrandDna = async (
  supabase: SupabaseClient,
  dna: BrandDna,
): Promise<BrandDna> => {
  const parsed = parseBrandDna(dna, dna.productId)
  const { error } = await supabase
    .from('products')
    .update({ brand_dna: parsed })
    .eq('id', parsed.productId)
  if (error) {
    throw new Error(`Failed to save Brand DNA: ${error.message}`)
  }
  await writeDnaFileBestEffort(parsed.productId, parsed)
  return parsed
}

export const saveBrandDnaDraft = async (
  supabase: SupabaseClient,
  productId: string,
  draft: BrandDnaDraft | null,
): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .update({
      brand_dna_draft: draft?.draft ?? null,
      brand_dna_draft_url: draft?.sourceUrl ?? null,
    })
    .eq('id', productId)
  if (error) {
    throw new Error(`Failed to save Brand DNA draft: ${error.message}`)
  }
}

export const loadProductCatalogRow = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<{ catalog: ProductCatalog; source: 'cache' | 'file' | 'empty' }> => {
  const { data, error } = await supabase
    .from('products')
    .select('catalog')
    .eq('id', productId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load Catalog: ${error.message}`)
  }
  return loadProductCatalog({ productId, cache: data?.catalog ?? null })
}

export const saveProductCatalogRow = async (
  supabase: SupabaseClient,
  catalog: ProductCatalog,
): Promise<ProductCatalog> => {
  const parsed = parseProductCatalog(catalog, catalog.productId)
  const { error } = await supabase
    .from('products')
    .update({ catalog: parsed })
    .eq('id', parsed.productId)
  if (error) {
    throw new Error(`Failed to save Catalog: ${error.message}`)
  }
  await writeCatalogFileBestEffort(parsed.productId, parsed)
  return parsed
}
