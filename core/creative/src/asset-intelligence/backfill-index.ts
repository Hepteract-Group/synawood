/** Wave 2J / #584 — library assets missing thumbs or visual embeddings. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { shotNeedsKeyframeThumb, type AssetMediaKind } from './extract-shot-thumb'
import {
  listAssetIndexStatuses,
  listUnindexedAssetIds,
  type AssetIndexStatusItem,
} from './index-status'
import { isPaidIndexSoftSkip } from './soft-skip'
import { isKeyframeThumbsMissing } from './thumbs-missing'
import { VISUAL_EMBED_FAILED_PREFIX } from './visual-embed-status'

export type BackfillAsset = {
  id: string
  kind: AssetMediaKind
}

export type BackfillShot = {
  assetId: string
  thumbBlobKey: string | null
}

const isInFlight = (status: AssetIndexStatusItem['status']): boolean =>
  status === 'pending' || status === 'indexing'

/** Chip Retry already lists these; auto-backfill would loop spend. */
const isChipRetryRow = (item: AssetIndexStatusItem): boolean =>
  item.status === 'failed' ||
  isPaidIndexSoftSkip(item.lastError) ||
  isKeyframeThumbsMissing(item.lastError) ||
  Boolean(item.lastError?.includes(VISUAL_EMBED_FAILED_PREFIX))

const listReindexBackfillAssetIds = (input: {
  assets: BackfillAsset[]
  indexed: AssetIndexStatusItem[]
  shots: BackfillShot[]
  visualAssetIds: string[]
}): string[] => {
  const indexedById = new Map(input.indexed.map((item) => [item.assetId, item]))
  const visual = new Set(input.visualAssetIds)
  const shotsByAsset = new Map<string, BackfillShot[]>()
  for (const shot of input.shots) {
    const list = shotsByAsset.get(shot.assetId) ?? []
    list.push(shot)
    shotsByAsset.set(shot.assetId, list)
  }

  const ids: string[] = []
  for (const asset of input.assets) {
    if (!shotNeedsKeyframeThumb(asset.kind)) continue
    const state = indexedById.get(asset.id)
    if (!state || isInFlight(state.status) || isChipRetryRow(state)) continue
    const shots = shotsByAsset.get(asset.id) ?? []
    const missingThumb = shots.length === 0 || shots.some((shot) => !shot.thumbBlobKey)
    const missingVisual = !visual.has(asset.id)
    if (missingThumb || missingVisual) ids.push(asset.id)
  }
  return ids
}

/** Unindexed assets plus indexed video/image missing thumbs or `kind=visual`. */
export const listBackfillAssetIds = (input: {
  assetIds: string[]
  assets: BackfillAsset[]
  indexed: AssetIndexStatusItem[]
  shots: BackfillShot[]
  visualAssetIds: string[]
}): string[] => {
  const unindexed = listUnindexedAssetIds(input.assetIds, input.indexed)
  const reindex = listReindexBackfillAssetIds(input)
  return [...new Set([...unindexed, ...reindex])]
}

export const loadBackfillFacts = async (input: {
  supabase: SupabaseClient
  productId: string
  assetIds: string[]
}): Promise<{ shots: BackfillShot[]; visualAssetIds: string[] }> => {
  const ids = [...new Set(input.assetIds.filter(Boolean))]
  if (ids.length === 0) return { shots: [], visualAssetIds: [] }

  const [shotsRes, visualRes] = await Promise.all([
    input.supabase
      .from('asset_shots')
      .select('asset_id, thumb_blob_key')
      .eq('product_id', input.productId)
      .in('asset_id', ids),
    input.supabase
      .from('asset_embeddings')
      .select('asset_id')
      .eq('product_id', input.productId)
      .eq('kind', 'visual')
      .in('asset_id', ids),
  ])

  if (shotsRes.error) {
    throw new Error(`list backfill shots failed: ${shotsRes.error.message}`)
  }
  if (visualRes.error) {
    throw new Error(`list backfill visual embeddings failed: ${visualRes.error.message}`)
  }

  return {
    shots: (shotsRes.data ?? []).map((row) => ({
      assetId: row.asset_id as string,
      thumbBlobKey: (row.thumb_blob_key as string | null) ?? null,
    })),
    visualAssetIds: [...new Set((visualRes.data ?? []).map((row) => row.asset_id as string))],
  }
}

/** Project library assets that still need first index or thumbs/visual reindex. */
export const resolveLibraryBackfill = async (input: {
  supabase: SupabaseClient
  productId: string
  projectId: string
}): Promise<{
  assetIds: string[]
  indexed: AssetIndexStatusItem[]
  backfillAssetIds: string[]
}> => {
  const { data: assetRows, error: assetError } = await input.supabase
    .from('assets')
    .select('id, source, kind')
    .eq('product_id', input.productId)
    .eq('project_id', input.projectId)
  if (assetError) {
    throw new Error(`Failed to list project assets: ${assetError.message}`)
  }

  const assets: BackfillAsset[] = (assetRows ?? [])
    .filter((row) => (row.source as string | null) !== 'brand_kit')
    .map((row) => ({
      id: row.id as string,
      kind: row.kind as AssetMediaKind,
    }))
  const assetIds = assets.map((asset) => asset.id)
  const indexed = await listAssetIndexStatuses({
    supabase: input.supabase,
    productId: input.productId,
    assetIds,
  })
  const facts = await loadBackfillFacts({
    supabase: input.supabase,
    productId: input.productId,
    assetIds,
  })
  return {
    assetIds,
    indexed,
    backfillAssetIds: listBackfillAssetIds({
      assetIds,
      assets,
      indexed,
      shots: facts.shots,
      visualAssetIds: facts.visualAssetIds,
    }),
  }
}
