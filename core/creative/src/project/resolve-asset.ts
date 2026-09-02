import type { SupabaseClient } from '@supabase/supabase-js'
import { attachAsset } from './operations'
import type { ProjectAsset, StudioProject } from './schema'

export type AssetTableRow = {
  id: string
  kind: string
  blob_key: string
  content_type: string | null
  source: string
  probe: Record<string, unknown> | null
}

export const projectAssetFromRow = (row: AssetTableRow): ProjectAsset => ({
  id: row.id,
  kind: row.kind as ProjectAsset['kind'],
  blobKey: row.blob_key,
  contentType: row.content_type ?? undefined,
  source: row.source as ProjectAsset['source'],
  probe: row.probe ?? {},
})

/**
 * Review (and other content URLs) must serve extract logos before Apply hydrates
 * them onto project JSON. Prefer the snapshot; fall back to the project-scoped
 * assets row.
 */
export const resolveProjectAsset = async (input: {
  supabase: SupabaseClient
  project: StudioProject
  assetId: string
}): Promise<ProjectAsset | null> => {
  const onProject = input.project.assets.find((asset) => asset.id === input.assetId)
  if (onProject) return onProject

  const { data, error } = await input.supabase
    .from('assets')
    .select('id, kind, blob_key, content_type, source, probe')
    .eq('id', input.assetId)
    .eq('project_id', input.project.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load asset: ${error.message}`)
  }
  if (!data) return null
  return projectAssetFromRow(data as AssetTableRow)
}

/**
 * Story Builder / product library (#441): attach an indexed asset onto project
 * JSON when the row lives in this product (any project_id) but was removed from
 * the bin snapshot — or never attached after index.
 */
export const ensureAssetOnProject = async (input: {
  supabase: SupabaseClient
  project: StudioProject
  assetId: string
}): Promise<{ project: StudioProject; asset: ProjectAsset; attached: boolean }> => {
  const existing = input.project.assets.find((asset) => asset.id === input.assetId)
  if (existing) {
    return { project: input.project, asset: existing, attached: false }
  }

  const { data, error } = await input.supabase
    .from('assets')
    .select('id, kind, blob_key, content_type, source, probe, product_id')
    .eq('id', input.assetId)
    .eq('product_id', input.project.productId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load product asset: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Asset ${input.assetId} is not in this product library`)
  }

  const asset = projectAssetFromRow(data as AssetTableRow)
  return {
    project: attachAsset(input.project, asset),
    asset,
    attached: true,
  }
}

/** Attach extract logo/still onto the project snapshot, skipping duplicates. */
export const attachMissingExtractAssets = (
  project: StudioProject,
  assets: ProjectAsset[],
): StudioProject => {
  const seen = new Set(project.assets.map((asset) => asset.id))
  let next = project
  for (const asset of assets) {
    if (seen.has(asset.id)) continue
    seen.add(asset.id)
    next = attachAsset(next, asset)
  }
  return next
}
