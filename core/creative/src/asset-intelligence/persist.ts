/** Wave 2C / #164–#165 — persist index state, shots, and tags. */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assetIndexStateFromRow,
  type AssetIndexStage,
  type AssetIndexState,
  type AssetIndexStatus,
  type AssetTagSource,
} from './schema'
import type { ProposedShot } from './shots'
import type { TranscriptSegment } from './transcript'

export type PersistedShot = {
  id: string
  ordinal: number
  startMs: number
  endMs: number | null
  thumbBlobKey: string | null
}

export const upsertAssetIndexState = async (
  supabase: SupabaseClient,
  input: {
    assetId: string
    productId: string
    status: AssetIndexStatus
    stage: AssetIndexStage
    caption?: string | null
    transcriptExcerpt?: string | null
    transcriptSegments?: TranscriptSegment[] | null
    lastError?: string | null
    faceDetectRan?: boolean
    indexedAt?: string | null
  },
): Promise<AssetIndexState> => {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    product_id: input.productId,
    status: input.status,
    stage: input.stage,
    updated_at: now,
  }
  if ('caption' in input) patch.caption = input.caption ?? null
  if ('transcriptExcerpt' in input) patch.transcript_excerpt = input.transcriptExcerpt ?? null
  if ('transcriptSegments' in input) patch.transcript_segments = input.transcriptSegments ?? []
  if ('lastError' in input) patch.last_error = input.lastError ?? null
  if ('faceDetectRan' in input) patch.face_detect_ran = input.faceDetectRan ?? false
  if ('indexedAt' in input) patch.indexed_at = input.indexedAt ?? null

  const { data: existing } = await supabase
    .from('asset_index_state')
    .select('asset_id')
    .eq('asset_id', input.assetId)
    .maybeSingle()

  const query = existing
    ? supabase.from('asset_index_state').update(patch).eq('asset_id', input.assetId)
    : supabase.from('asset_index_state').insert({
        asset_id: input.assetId,
        caption: null,
        transcript_excerpt: null,
        last_error: null,
        face_detect_ran: false,
        indexed_at: null,
        created_at: now,
        ...patch,
      })

  const { data, error } = await query.select('*').single()
  if (error) {
    throw new Error(`Failed to upsert asset_index_state: ${error.message}`)
  }
  return assetIndexStateFromRow(data as Parameters<typeof assetIndexStateFromRow>[0])
}

export const replaceAssetShots = async (
  supabase: SupabaseClient,
  input: {
    assetId: string
    productId: string
    shots: ProposedShot[]
    thumbBlobKeyByOrdinal?: Record<number, string | null>
  },
): Promise<PersistedShot[]> => {
  const { error: deleteError } = await supabase
    .from('asset_shots')
    .delete()
    .eq('asset_id', input.assetId)
  if (deleteError) {
    throw new Error(`Failed to clear asset_shots: ${deleteError.message}`)
  }
  if (input.shots.length === 0) return []

  const rows = input.shots.map((shot) => ({
    id: crypto.randomUUID(),
    asset_id: input.assetId,
    product_id: input.productId,
    ordinal: shot.ordinal,
    start_ms: shot.startMs,
    end_ms: shot.endMs,
    thumb_blob_key: input.thumbBlobKeyByOrdinal?.[shot.ordinal] ?? null,
  }))
  const { error: insertError } = await supabase.from('asset_shots').insert(rows)
  if (insertError) {
    throw new Error(`Failed to insert asset_shots: ${insertError.message}`)
  }
  return rows.map((row) => ({
    id: row.id,
    ordinal: row.ordinal,
    startMs: row.start_ms,
    endMs: row.end_ms,
    thumbBlobKey: row.thumb_blob_key,
  }))
}

/** Replace caption-sourced tags for an asset (idempotent reindex). */
export const replaceAssetTags = async (
  supabase: SupabaseClient,
  input: {
    assetId: string
    productId: string
    tags: string[]
    source: AssetTagSource
  },
): Promise<number> => {
  const { error: deleteError } = await supabase
    .from('asset_tags')
    .delete()
    .eq('asset_id', input.assetId)
    .eq('source', input.source)
  if (deleteError) {
    throw new Error(`Failed to clear asset_tags: ${deleteError.message}`)
  }
  if (input.tags.length === 0) return 0

  const rows = input.tags.map((tag) => ({
    asset_id: input.assetId,
    product_id: input.productId,
    tag,
    source: input.source,
  }))
  const { error: insertError } = await supabase.from('asset_tags').insert(rows)
  if (insertError) {
    throw new Error(`Failed to insert asset_tags: ${insertError.message}`)
  }
  return rows.length
}

/** Replace whole-asset embeddings for a kind+model (idempotent reindex). */
export const replaceAssetEmbedding = async (
  supabase: SupabaseClient,
  input: {
    assetId: string
    productId: string
    kind: 'text' | 'visual'
    modelId: string
    /** pgvector literal e.g. `[0.1,0.2,…]` (1536-d). */
    pgVector: string
    shotId?: string | null
  },
): Promise<void> => {
  let deleteQuery = supabase
    .from('asset_embeddings')
    .delete()
    .eq('asset_id', input.assetId)
    .eq('kind', input.kind)
    .eq('model_id', input.modelId)

  deleteQuery = input.shotId
    ? deleteQuery.eq('shot_id', input.shotId)
    : deleteQuery.is('shot_id', null)

  const { error: deleteError } = await deleteQuery
  if (deleteError) {
    throw new Error(`Failed to clear asset_embeddings: ${deleteError.message}`)
  }

  const { error: insertError } = await supabase.from('asset_embeddings').insert({
    asset_id: input.assetId,
    product_id: input.productId,
    shot_id: input.shotId ?? null,
    kind: input.kind,
    model_id: input.modelId,
    embedding: input.pgVector,
  })
  if (insertError) {
    throw new Error(`Failed to insert asset_embeddings: ${insertError.message}`)
  }
}
