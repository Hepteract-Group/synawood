/** Wave 2J / #588 + #658 — Analyze `segment` pack → new asset_shots (ADR-0053 §3). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_MODEL_PROFILE_ID, resolveModelRef } from '../model-profiles'
import { getBlobBytes as getBlobBytesDefault, type BlobEnv } from '../persistence/blob'
import type { JsonSchemaObject } from './analyze-schema'
import { ASSET_TEXT_EMBEDDING_MODEL_ID, embedAssetForIndex } from './embed'
import { embedShotVisualForIndex } from './embed-shot-visual'
import {
  replaceAssetEmbedding,
  replaceAssetShots,
  upsertAssetIndexState,
  type PersistedShot,
} from './persist'
import type { ProposedShot } from './shots'
import { KEYFRAME_THUMBS_MISSING_PREFIX } from './thumbs-missing'
import { transcriptWindowForShot, type TranscriptSegment } from './transcript'
import { writeShotThumbs } from './write-shot-thumbs'

export const SEGMENT_SCHEMA: JsonSchemaObject = {
  type: 'object',
  properties: {
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startMs: { type: 'number' },
          endMs: { type: 'number' },
          label: { type: 'string' },
        },
        required: ['startMs', 'endMs', 'label'],
      },
    },
  },
  required: ['shots'],
}

type SegmentRow = {
  startMs?: unknown
  endMs?: unknown
  label?: unknown
}

export const shotsFromSegmentResult = (result: Record<string, unknown>): ProposedShot[] => {
  const raw = result.shots
  if (!Array.isArray(raw)) return []
  const shots: ProposedShot[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const startMs = Number((row as SegmentRow).startMs)
    const endMs = Number((row as SegmentRow).endMs)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    shots.push({
      ordinal: shots.length,
      startMs: Math.max(0, Math.round(startMs)),
      endMs: Math.max(0, Math.round(endMs)),
    })
  }
  return shots
}

type SegmentAssetRow = {
  id: string
  product_id: string
  kind: 'video' | 'image' | 'audio' | 'other'
  blob_key: string
  content_type: string | null
  probe: Record<string, unknown> | null
}

const loadSegmentAsset = async (
  supabase: SupabaseClient,
  assetId: string,
): Promise<SegmentAssetRow | null> => {
  const { data, error } = await supabase.from('assets').select('*').eq('id', assetId).maybeSingle()
  if (error || !data) return null
  return data as SegmentAssetRow
}

const loadSegmentIndex = async (
  supabase: SupabaseClient,
  productId: string,
  assetId: string,
): Promise<{
  caption: string | null
  transcriptExcerpt: string | null
  segments: TranscriptSegment[]
}> => {
  const { data } = await supabase
    .from('asset_index_state')
    .select('caption, transcript_excerpt, transcript_segments')
    .eq('product_id', productId)
    .eq('asset_id', assetId)
    .maybeSingle()
  return {
    caption: (data?.caption as string | null) ?? null,
    transcriptExcerpt: (data?.transcript_excerpt as string | null) ?? null,
    segments: Array.isArray(data?.transcript_segments)
      ? (data.transcript_segments as TranscriptSegment[])
      : [],
  }
}

const clearShotEmbeddings = async (supabase: SupabaseClient, assetId: string): Promise<void> => {
  const { error } = await supabase
    .from('asset_embeddings')
    .delete()
    .eq('asset_id', assetId)
    .not('shot_id', 'is', null)
  if (error) {
    throw new Error(`Failed to clear shot embeddings: ${error.message}`)
  }
}

const missingThumbsNote = (detail: string): string =>
  `${KEYFRAME_THUMBS_MISSING_PREFIX}: ${detail}. Retry index.`.slice(0, 500)

export type CommitSegmentDeps = {
  loadAsset?: typeof loadSegmentAsset
  writeShotThumbs?: typeof writeShotThumbs
  getBlobBytes?: typeof getBlobBytesDefault
  replaceAssetShots?: typeof replaceAssetShots
  upsertAssetIndexState?: typeof upsertAssetIndexState
  replaceAssetEmbedding?: typeof replaceAssetEmbedding
  clearShotEmbeddings?: typeof clearShotEmbeddings
  loadIndex?: typeof loadSegmentIndex
  embedAssetForIndex?: typeof embedAssetForIndex
  embedShotVisualForIndex?: typeof embedShotVisualForIndex
}

/** New shot ids. Does not take a Studio project — placed clip trims stay on the clip. */
export const commitSegmentShots = async (
  input: {
    supabase: SupabaseClient
    assetId: string
    productId: string
    result: Record<string, unknown>
    blobEnv?: BlobEnv
    modelProfileId?: string
  },
  deps?: CommitSegmentDeps,
): Promise<{ shots: PersistedShot[]; skipped: boolean; thumbNote: string | null }> => {
  const proposed = shotsFromSegmentResult(input.result)
  if (proposed.length === 0) return { shots: [], skipped: true, thumbNote: null }

  const upsertState = deps?.upsertAssetIndexState ?? upsertAssetIndexState
  const replaceShots = deps?.replaceAssetShots ?? replaceAssetShots
  const writeThumbs = deps?.writeShotThumbs ?? writeShotThumbs
  const getBytes = deps?.getBlobBytes ?? getBlobBytesDefault
  const loadAsset = deps?.loadAsset ?? loadSegmentAsset
  const clearEmbeds = deps?.clearShotEmbeddings ?? clearShotEmbeddings
  const loadIndex = deps?.loadIndex ?? loadSegmentIndex
  const embedText = deps?.embedAssetForIndex ?? embedAssetForIndex
  const embedVisual = deps?.embedShotVisualForIndex ?? embedShotVisualForIndex
  const replaceEmbed = deps?.replaceAssetEmbedding ?? replaceAssetEmbedding

  await upsertState(input.supabase, {
    assetId: input.assetId,
    productId: input.productId,
    status: 'indexing',
    stage: 'analyze',
  })

  const asset = await loadAsset(input.supabase, input.assetId)
  let thumbBlobKeyByOrdinal: Record<number, string> = {}
  let thumbNote: string | null = null

  if (!input.blobEnv || !asset) {
    thumbNote = missingThumbsNote(
      input.blobEnv ? 'asset blob missing after segment' : 'segment commit had no Blob env',
    )
  } else {
    const bytes = await getBytes({ blobEnv: input.blobEnv, blobKey: asset.blob_key })
    const fileName =
      typeof asset.probe?.name === 'string'
        ? asset.probe.name
        : (asset.blob_key.split('/').pop() ?? '')
    const written = await writeThumbs({
      blobEnv: input.blobEnv,
      productId: input.productId,
      assetId: input.assetId,
      kind: asset.kind,
      bytes,
      contentType: asset.content_type ?? 'application/octet-stream',
      fileName,
      shots: proposed,
    })
    thumbBlobKeyByOrdinal = written.thumbBlobKeyByOrdinal
    thumbNote = written.thumbNote
  }

  const shots = await replaceShots(input.supabase, {
    assetId: input.assetId,
    productId: input.productId,
    shots: proposed,
    thumbBlobKeyByOrdinal,
  })
  await clearEmbeds(input.supabase, input.assetId)

  const modelProfileId = input.modelProfileId?.trim() || DEFAULT_MODEL_PROFILE_ID
  const useMock = modelProfileId === 'ci-stub'
  const index = await loadIndex(input.supabase, input.productId, input.assetId)

  for (const shot of shots) {
    const window =
      transcriptWindowForShot({ startMs: shot.startMs, endMs: shot.endMs }, index.segments) ??
      index.transcriptExcerpt
    const shotEmbed = await embedText({
      caption: index.caption,
      transcriptExcerpt: window,
      useMock,
      modelId: ASSET_TEXT_EMBEDDING_MODEL_ID,
    })
    if (shotEmbed.skipped) continue
    await replaceEmbed(input.supabase, {
      assetId: input.assetId,
      productId: input.productId,
      kind: 'text',
      modelId: shotEmbed.text.modelId,
      pgVector: shotEmbed.text.pgVector,
      shotId: shot.id,
    })
  }

  const visualRef = resolveModelRef(modelProfileId, 'embed_visual')
  const useVisualMock = useMock || visualRef.modelId.startsWith('mock-')
  if (input.blobEnv) {
    for (const shot of shots) {
      if (!shot.thumbBlobKey) continue
      const thumbBytes = await getBytes({
        blobEnv: input.blobEnv,
        blobKey: shot.thumbBlobKey,
      })
      const visual = await embedVisual({
        thumbBytes,
        seed: shot.id,
        useMock: useVisualMock,
        modelId: visualRef.modelId,
      })
      if (visual.skipped) continue
      await replaceEmbed(input.supabase, {
        assetId: input.assetId,
        productId: input.productId,
        kind: 'visual',
        modelId: visual.modelId,
        pgVector: visual.pgVector,
        shotId: shot.id,
      })
    }
  }

  const missingThumbs = shots.some((shot) => !shot.thumbBlobKey)
  await upsertState(input.supabase, {
    assetId: input.assetId,
    productId: input.productId,
    status: missingThumbs ? 'failed' : 'ready',
    stage: missingThumbs ? 'failed' : 'ready',
    lastError: missingThumbs ? (thumbNote ?? missingThumbsNote('extract failed')) : thumbNote,
  })
  return { shots, skipped: false, thumbNote }
}
