/** Wave 2C / #173 — batch index status for Media bin chip. */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssetIndexStage, AssetIndexStatus } from './schema'
import { isPaidIndexSoftSkip } from './soft-skip'
import { isKeyframeThumbsMissing } from './thumbs-missing'
import { isVisualEmbedFailed, VISUAL_EMBED_SKIPPED_PREFIX } from './visual-embed-status'

export type AssetIndexStatusItem = {
  assetId: string
  status: AssetIndexStatus
  stage: AssetIndexStage
  lastError: string | null
  /** Set after `attachVisualEmbeddingFlags` — ready rows without a visual embedding. */
  hasVisualEmbedding?: boolean
}

export type AssetIndexStatusSummary = {
  total: number
  ready: number
  failed: number
  active: number
  /** Ready rows that soft-skipped paid stages (#458). */
  softSkipped: number
  /** Ready rows whose keyframe extract failed (#580). */
  thumbsMissing: number
  /** Ready rows whose visual embed API failed (#582). */
  visualFailed: number
  /** Ready rows with no kind=visual embedding (#662). */
  visualMissing: number
  /** Indexing rows on the Analyze segment pass (#588). */
  segmenting: number
}

const isActiveStatus = (status: string): boolean => status === 'pending' || status === 'indexing'

export const isActiveIndexStatus = isActiveStatus

/** Story Appearance search is blocked until visual embeddings exist (#662). */
export const needsAppearanceIndex = (item: {
  status: string
  lastError: string | null
  hasVisualEmbedding?: boolean
}): boolean => {
  if (isKeyframeThumbsMissing(item.lastError)) {
    return item.status === 'ready' || item.status === 'failed'
  }
  if (item.status !== 'ready') return false
  if (isVisualEmbedFailed(item.lastError)) return true
  if (item.lastError?.includes(VISUAL_EMBED_SKIPPED_PREFIX)) return true
  return item.hasVisualEmbedding === false
}

export const attachVisualEmbeddingFlags = async (input: {
  supabase: SupabaseClient
  productId: string
  items: AssetIndexStatusItem[]
}): Promise<AssetIndexStatusItem[]> => {
  const readyIds = [
    ...new Set(input.items.filter((item) => item.status === 'ready').map((item) => item.assetId)),
  ]
  if (readyIds.length === 0) return input.items

  const { data, error } = await input.supabase
    .from('asset_embeddings')
    .select('asset_id')
    .eq('product_id', input.productId)
    .eq('kind', 'visual')
    .in('asset_id', readyIds)

  if (error) return input.items

  const have = new Set((data ?? []).map((row) => row.asset_id as string))
  return input.items.map((item) =>
    item.status === 'ready' ? { ...item, hasVisualEmbedding: have.has(item.assetId) } : item,
  )
}

export const summarizeAssetIndexStatuses = (
  items: AssetIndexStatusItem[],
): AssetIndexStatusSummary => {
  let ready = 0
  let failed = 0
  let active = 0
  let softSkipped = 0
  let thumbsMissing = 0
  let visualFailed = 0
  let visualMissing = 0
  let segmenting = 0
  for (const item of items) {
    if (item.stage === 'analyze' && isActiveStatus(item.status)) segmenting += 1
    if (
      isKeyframeThumbsMissing(item.lastError) &&
      (item.status === 'ready' || item.status === 'failed')
    ) {
      thumbsMissing += 1
    }
    if (item.status === 'ready') {
      ready += 1
      if (isPaidIndexSoftSkip(item.lastError)) softSkipped += 1
      if (isVisualEmbedFailed(item.lastError)) visualFailed += 1
      if (item.hasVisualEmbedding === false) visualMissing += 1
    } else if (item.status === 'failed') failed += 1
    else if (isActiveStatus(item.status)) active += 1
  }
  return {
    total: items.length,
    ready,
    failed,
    active,
    softSkipped,
    thumbsMissing,
    visualFailed,
    visualMissing,
    segmenting,
  }
}

/**
 * Status rows for the given asset ids that already have `asset_index_state`.
 * Assets not yet enqueued are omitted (avoids treating pre-index library as pending).
 */
export const listAssetIndexStatuses = async (input: {
  supabase: SupabaseClient
  productId: string
  assetIds: string[]
}): Promise<AssetIndexStatusItem[]> => {
  const ids = [...new Set(input.assetIds.filter(Boolean))]
  if (ids.length === 0) return []

  const { data, error } = await input.supabase
    .from('asset_index_state')
    .select('asset_id, status, stage, last_error')
    .eq('product_id', input.productId)
    .in('asset_id', ids)

  if (error) {
    throw new Error(`list asset index status failed: ${error.message}`)
  }

  const allowed = new Set(ids)
  return (data ?? [])
    .filter((row) => allowed.has(row.asset_id as string))
    .map(
      (row) =>
        ({
          assetId: row.asset_id as string,
          status: row.status as AssetIndexStatus,
          stage: row.stage as AssetIndexStage,
          lastError: (row.last_error as string | null) ?? null,
        }) satisfies AssetIndexStatusItem,
    )
}

export const indexingChipLabel = (summary: AssetIndexStatusSummary): string | null => {
  if (summary.total === 0) return null
  if (summary.active > 0 || summary.segmenting > 0) {
    const count = `Preparing ${summary.ready} of ${summary.total}…`
    return summary.segmenting > 0 ? `${count} Finding shots` : count
  }
  if (summary.thumbsMissing > 0) {
    return summary.thumbsMissing === 1
      ? '1 file is missing preview stills'
      : `${summary.thumbsMissing} files are missing preview stills`
  }
  if (summary.failed > 0) {
    return summary.failed === 1
      ? "Couldn't prepare 1 file"
      : `Couldn't prepare ${summary.failed} files`
  }
  if (summary.visualFailed > 0) {
    return summary.visualFailed === 1
      ? "Couldn't learn how 1 file looks"
      : `Couldn't learn how ${summary.visualFailed} files look`
  }
  if (summary.softSkipped > 0) {
    return summary.softSkipped === 1
      ? '1 file skipped extra processing'
      : `${summary.softSkipped} files skipped extra processing`
  }
  return null
}

/** Map indexer errors to copy a visitor can act on. */
export const visitorLibraryError = (raw: string | null | undefined, fallback: string): string => {
  const text = raw?.trim()
  if (!text) return fallback
  if (/keyframe thumbs|ffmpeg/i.test(text)) {
    return 'Preview stills didn’t save. Retry to generate them.'
  }
  if (/visual embed/i.test(text)) return "Couldn't match how this file looks."
  if (/paid (index|stage)|paid models/i.test(text)) return 'Extra processing was skipped.'
  if (/\bindex(ing)?\b/i.test(text)) return fallback
  return text
}

/** Project assets with no `asset_index_state` row yet (#445 backfill). */
export const listUnindexedAssetIds = (
  assetIds: string[],
  indexed: AssetIndexStatusItem[],
): string[] => {
  const have = new Set(indexed.map((item) => item.assetId))
  return [...new Set(assetIds.filter(Boolean))].filter((id) => !have.has(id))
}
