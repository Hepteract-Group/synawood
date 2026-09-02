import type { SupabaseClient } from '@supabase/supabase-js'
import { libraryItemFromRow, type LibraryItem } from './schema'

export const insertLibraryItem = async (input: {
  supabase: SupabaseClient
  id?: string
  productId: string
  kind: LibraryItem['kind']
  label: string
  source: 'generated' | 'imported'
  createdBy: 'user' | 'agent' | 'import'
  recipe: Record<string, unknown>
  blobKey?: string | null
}): Promise<LibraryItem> => {
  const row = {
    ...(input.id ? { id: input.id } : {}),
    product_id: input.productId,
    kind: input.kind,
    label: input.label,
    source: input.source,
    license_status: 'unknown',
    commercial_use_allowed: false,
    recipe: input.recipe,
    blob_key: input.blobKey ?? null,
    created_by: input.createdBy,
  }
  const { data, error } = await input.supabase
    .from('studio_library_items')
    .insert(row)
    .select(
      'id, product_id, kind, label, source, license_status, commercial_use_allowed, recipe, blob_key, created_by, created_at',
    )
    .single()
  if (error || !data) {
    throw new Error(`Failed to save library item: ${error?.message ?? 'no row'}`)
  }
  return libraryItemFromRow({
    ...data,
    recipe: (data.recipe ?? {}) as Record<string, unknown>,
  })
}
