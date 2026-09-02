import type { SupabaseClient } from '@supabase/supabase-js'
import { isStylePackId } from '../effects/packs'
import { isTreatmentId } from '../effects/treatments'
import type { StudioProject } from '../project/schema'
import { libraryItemFromRow, type LibraryItem } from './schema'

export const isLibraryItemPublishable = (item: {
  source: LibraryItem['source']
  licenseStatus: LibraryItem['licenseStatus']
  commercialUseAllowed: boolean
}): boolean => {
  if (item.source === 'first-party' || item.licenseStatus === 'first-party') return true
  return item.licenseStatus === 'cleared' && item.commercialUseAllowed === true
}

export const collectProjectLibraryItemIds = (project: StudioProject): string[] => {
  const ids = new Set<string>()
  if (project.stylePackId && !isStylePackId(project.stylePackId)) {
    ids.add(project.stylePackId)
  }
  for (const clip of project.clips) {
    if (clip.filterId && !isStylePackId(clip.filterId)) {
      ids.add(clip.filterId)
    }
    for (const treatment of clip.treatments ?? []) {
      if (!isTreatmentId(treatment.id)) {
        ids.add(treatment.id)
      }
    }
  }
  for (const overlay of project.overlays) {
    if (overlay.libraryItemId) {
      ids.add(overlay.libraryItemId)
    }
  }
  const stingerId = project.compositionSource?.artDirection?.stingerLibraryItemId
  if (stingerId) ids.add(stingerId)
  return [...ids]
}

export const assertProjectLibraryLicensesPublishable = async (
  supabase: SupabaseClient,
  productId: string,
  project: StudioProject,
): Promise<void> => {
  const ids = collectProjectLibraryItemIds(project)
  if (ids.length === 0) return

  const { data, error } = await supabase
    .from('studio_library_items')
    .select(
      'id, product_id, kind, label, source, license_status, commercial_use_allowed, recipe, blob_key, created_by, created_at',
    )
    .eq('product_id', productId)
    .in('id', ids)
  if (error) {
    throw new Error(`Failed to check library licenses: ${error.message}`)
  }

  const byId = new Map(
    (data ?? []).map((row) => [
      row.id as string,
      libraryItemFromRow({
        ...row,
        recipe: (row.recipe ?? {}) as Record<string, unknown>,
      }),
    ]),
  )

  const blockers: string[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (!item) {
      blockers.push(`${id.slice(0, 8)}… (missing library row)`)
      continue
    }
    if (!isLibraryItemPublishable(item)) {
      blockers.push(`${item.label} (${item.licenseStatus}, commercial-use off)`)
    }
  }
  if (blockers.length === 0) return
  throw new Error(
    `Approve blocked: ${blockers.length} overlay library item(s) are not cleared for commercial use. Tick “I have the right to use this commercially” in the bin, or remove them. ${blockers.slice(0, 3).join('; ')}`,
  )
}

export const clearLibraryItemCommercialUse = async (input: {
  supabase: SupabaseClient
  productId: string
  itemId: string
}): Promise<LibraryItem> => {
  const { data, error } = await input.supabase
    .from('studio_library_items')
    .update({
      license_status: 'cleared',
      commercial_use_allowed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.itemId)
    .eq('product_id', input.productId)
    .select(
      'id, product_id, kind, label, source, license_status, commercial_use_allowed, recipe, blob_key, created_by, created_at',
    )
    .single()
  if (error || !data) {
    throw new Error(`Failed to clear library license: ${error?.message ?? 'no row'}`)
  }
  return libraryItemFromRow({
    ...data,
    recipe: (data.recipe ?? {}) as Record<string, unknown>,
  })
}
