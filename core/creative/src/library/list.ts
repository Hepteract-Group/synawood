import type { SupabaseClient } from '@supabase/supabase-js'
import { listFirstPartyLibraryItems } from './first-party'
import { libraryItemFromRow, type LibraryItem, type LibraryKind } from './schema'

export const listProductLibraryItems = async (input: {
  supabase: SupabaseClient
  productId: string
  kind?: LibraryKind
}): Promise<LibraryItem[]> => {
  let query = input.supabase
    .from('studio_library_items')
    .select(
      'id, product_id, kind, label, source, license_status, commercial_use_allowed, recipe, blob_key, created_by, created_at',
    )
    .eq('product_id', input.productId)
    .order('created_at', { ascending: false })

  if (input.kind) {
    query = query.eq('kind', input.kind)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list library items: ${error.message}`)
  }

  return (data ?? []).map((row) =>
    libraryItemFromRow({
      ...row,
      recipe: (row.recipe ?? {}) as Record<string, unknown>,
    }),
  )
}

/** First-party packs plus product rows. Omit supabase to skip the table (unit tests). */
export const listLibrary = async (input: {
  supabase?: SupabaseClient
  productId: string
  kind?: LibraryKind
}): Promise<LibraryItem[]> => {
  const firstParty = listFirstPartyLibraryItems(input.kind)
  if (!input.supabase) {
    return firstParty
  }
  const productItems = await listProductLibraryItems({
    supabase: input.supabase,
    productId: input.productId,
    kind: input.kind,
  })
  return [...firstParty, ...productItems]
}
