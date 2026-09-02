/** Retroactive structure tagging (ADR-0034 / #235). Node-only. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProject } from '../project/load'
import { saveProject } from '../project/save'
import { deriveCreativeStructureOnProject } from './mutations'
import { structureBeatCount } from './creative-structure'
import type { StudioProject } from '../project/schema'

/** Projects with scenes and empty beats are eligible (#235). */
export const shouldBackfillCreativeStructure = (project: StudioProject): boolean =>
  structureBeatCount(project.creativeStructure) === 0 && project.scenes.length > 0

export const backfillCreativeStructureForProduct = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<{ scanned: number; updated: number; skipped: number }> => {
  const { data, error } = await supabase
    .from('studio_projects')
    .select('id')
    .eq('product_id', productId)
  if (error) throw new Error(`Could not list projects: ${error.message}`)
  const ids = ((data as Array<{ id: string }> | null) ?? []).map((row) => row.id)
  let updated = 0
  let skipped = 0
  for (const id of ids) {
    const { project } = await loadProject(supabase, id)
    if (!shouldBackfillCreativeStructure(project)) {
      skipped += 1
      continue
    }
    const next = deriveCreativeStructureOnProject(project)
    if (structureBeatCount(next.creativeStructure) === 0) {
      skipped += 1
      continue
    }
    await saveProject(supabase, next, project.revision)
    updated += 1
  }
  return { scanned: ids.length, updated, skipped }
}
