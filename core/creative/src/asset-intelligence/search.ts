/** Wave 2C / #168 — product-scoped asset retrieval for Studio Tools. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeAssetTag } from './caption'
import {
  ASSET_TEXT_EMBEDDING_MODEL_ID,
  embedAssetForIndex,
  formatPgVector,
  mockTextEmbedding,
} from './embed'
import { embedVisualQuery } from './embed-shot-visual'
import { ASSET_EMBEDDING_DIMS } from './schema'
import type { VisualQueryVector } from './visual-query-vector'

export type { VisualQueryVector } from './visual-query-vector'

export type AssetSearchHit = {
  assetId: string
  productId: string
  caption: string | null
  transcriptExcerpt: string | null
  tags: string[]
  distance: number | null
  kind: string | null
}

export type AssetDescription = {
  assetId: string
  productId: string
  status: string
  stage: string
  caption: string | null
  transcriptExcerpt: string | null
  lastError: string | null
  tags: string[]
  shots: Array<{
    id: string
    ordinal: number
    startMs: number
    endMs: number | null
    thumbBlobKey: string | null
  }>
}

/** Cosine distance in [0, 2] for unit-ish vectors (lower = closer). */
export const cosineDistance = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) {
    throw new Error('cosineDistance requires equal non-empty vectors')
  }
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    na += x * x
    nb += y * y
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1
  return 1 - dot / denom
}

/**
 * Drop weak semantic neighbours (#443). Cosine distance on text-embedding-3-small:
 * related often under ~0.45; unrelated sole hits (e.g. "logo" → portrait) sit higher.
 */
export const MAX_TEXT_SEMANTIC_DISTANCE = 0.55

/**
 * Visual NN cutoff for kind=visual (#583). Same numeric band as text for now;
 * do not cosine-mix the two spaces — compare within kind only.
 */
export const MAX_VISUAL_SEMANTIC_DISTANCE = 0.55

export const filterByMaxDistance = <T extends { distance: number | null }>(
  rows: T[],
  maxDistance: number = MAX_TEXT_SEMANTIC_DISTANCE,
): T[] => rows.filter((row) => row.distance == null || row.distance <= maxDistance)

export const rankByCosineDistance = <T extends { embedding: number[] }>(
  query: number[],
  rows: T[],
  limit: number,
): Array<T & { distance: number }> =>
  rows
    .map((row) => ({ ...row, distance: cosineDistance(query, row.embedding) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, Math.max(1, Math.min(limit, 50)))

const parseVectorLiteral = (raw: unknown): number[] | null => {
  if (Array.isArray(raw) && raw.every((value) => typeof value === 'number')) {
    return raw as number[]
  }
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/^\[/, '').replace(/\]$/, '')
  if (!trimmed) return null
  const values = trimmed.split(',').map((part) => Number(part.trim()))
  if (values.length !== ASSET_EMBEDDING_DIMS || values.some((value) => !Number.isFinite(value))) {
    return null
  }
  return values
}

export const loadStoredVisualQueryVector = async (input: {
  supabase: SupabaseClient
  productId: string
  assetId: string
}): Promise<VisualQueryVector | null> => {
  const { data, error } = await input.supabase
    .from('asset_embeddings')
    .select('embedding, model_id')
    .eq('product_id', input.productId)
    .eq('asset_id', input.assetId)
    .eq('kind', 'visual')
    .limit(8)
  if (error || !data) return null
  for (const row of data) {
    const embedding = parseVectorLiteral(row.embedding)
    const modelId = String(row.model_id ?? '').trim()
    if (!embedding || !modelId) continue
    return { embedding, pgVector: formatPgVector(embedding), modelId }
  }
  return null
}

const hydrateHits = async (
  supabase: SupabaseClient,
  productId: string,
  ranked: Array<{ assetId: string; distance: number | null }>,
  options?: { includeUnindexed?: boolean },
): Promise<AssetSearchHit[]> => {
  if (ranked.length === 0) return []
  const ids = ranked.map((row) => row.assetId)
  const includeUnindexed = options?.includeUnindexed === true
  const [{ data: states }, { data: tagRows }, { data: assets }] = await Promise.all([
    supabase
      .from('asset_index_state')
      .select('asset_id, product_id, caption, transcript_excerpt, status')
      .eq('product_id', productId)
      .in('asset_id', ids),
    supabase
      .from('asset_tags')
      .select('asset_id, tag')
      .eq('product_id', productId)
      .in('asset_id', ids),
    supabase
      .from('assets')
      .select('id, kind, blob_key, probe')
      .eq('product_id', productId)
      .in('id', ids),
  ])

  const stateById = new Map(
    (states ?? []).map((row) => [
      row.asset_id as string,
      row as {
        asset_id: string
        product_id: string
        caption: string | null
        transcript_excerpt: string | null
        status: string
      },
    ]),
  )
  const tagsById = new Map<string, string[]>()
  for (const row of tagRows ?? []) {
    const assetId = row.asset_id as string
    const list = tagsById.get(assetId) ?? []
    list.push(row.tag as string)
    tagsById.set(assetId, list)
  }
  const assetById = new Map(
    (assets ?? []).map((row) => [
      row.id as string,
      row as {
        id: string
        kind: string
        blob_key: string
        probe: Record<string, unknown> | null
      },
    ]),
  )

  return ranked
    .map((row): AssetSearchHit | null => {
      const state = stateById.get(row.assetId)
      const asset = assetById.get(row.assetId)
      if (!asset) return null
      if (state?.status === 'ready') {
        return {
          assetId: row.assetId,
          productId: state.product_id,
          caption: state.caption,
          transcriptExcerpt: state.transcript_excerpt,
          tags: tagsById.get(row.assetId) ?? [],
          distance: row.distance,
          kind: asset.kind ?? null,
        }
      }
      if (!includeUnindexed) return null
      const probeName =
        typeof asset.probe?.name === 'string' ? asset.probe.name.trim().slice(0, 120) : null
      const fileName = asset.blob_key.split('/').filter(Boolean).pop() ?? asset.id
      return {
        assetId: row.assetId,
        productId,
        caption: probeName || fileName,
        transcriptExcerpt: null,
        tags: tagsById.get(row.assetId) ?? [],
        distance: row.distance,
        kind: asset.kind ?? null,
      }
    })
    .filter((hit): hit is AssetSearchHit => hit != null)
}

export const findAssetsSemantic = async (input: {
  supabase: SupabaseClient
  productId: string
  query: string
  limit?: number
  useMock?: boolean
  modelId?: string
  /** Override default MAX_TEXT_SEMANTIC_DISTANCE; pass Infinity to disable. */
  maxDistance?: number
}): Promise<AssetSearchHit[]> => {
  const query = input.query.trim()
  if (!query) return []
  const limit = Math.max(1, Math.min(input.limit ?? 12, 50))
  const maxDistance = input.maxDistance ?? MAX_TEXT_SEMANTIC_DISTANCE
  const modelId = input.modelId?.trim() || ASSET_TEXT_EMBEDDING_MODEL_ID

  const keywordHits = await findAssetsByKeyword({
    supabase: input.supabase,
    productId: input.productId,
    query,
    limit,
  })

  const embedResult = await embedAssetForIndex({
    caption: query,
    transcriptExcerpt: null,
    useMock: input.useMock,
    modelId,
  })
  if (embedResult.skipped) return keywordHits.slice(0, limit)

  const pgVector = embedResult.text.pgVector
  const { data: rpcRows, error: rpcError } = await input.supabase.rpc('match_asset_embeddings', {
    p_product_id: input.productId,
    p_query: pgVector,
    p_model_id: embedResult.text.modelId,
    p_match_count: limit,
    p_kind: 'text',
  })

  let ranked: Array<{ assetId: string; distance: number | null }> = []

  if (!rpcError && Array.isArray(rpcRows)) {
    ranked = rpcRows.map((row) => ({
      assetId: row.asset_id as string,
      distance: typeof row.distance === 'number' ? row.distance : null,
    }))
  } else {
    // Fallback for tests / environments without the RPC: fetch embeddings and rank in-process.
    const { data: embeddingRows, error } = await input.supabase
      .from('asset_embeddings')
      .select('asset_id, embedding, model_id')
      .eq('product_id', input.productId)
      .eq('kind', 'text')
      .eq('model_id', embedResult.text.modelId)
      .is('shot_id', null)
    if (error) {
      throw new Error(`find_assets failed: ${rpcError?.message ?? error.message}`)
    }

    const parsed = (embeddingRows ?? [])
      .map((row) => {
        const embedding = parseVectorLiteral(row.embedding)
        if (!embedding) return null
        return { assetId: row.asset_id as string, embedding }
      })
      .filter((row): row is { assetId: string; embedding: number[] } => row != null)

    ranked = rankByCosineDistance(embedResult.text.embedding, parsed, limit).map((row) => ({
      assetId: row.assetId,
      distance: row.distance,
    }))
  }

  const semanticHits = await hydrateHits(
    input.supabase,
    input.productId,
    filterByMaxDistance(ranked, maxDistance),
  )

  const seen = new Set(keywordHits.map((hit) => hit.assetId))
  const merged = [...keywordHits]
  for (const hit of semanticHits) {
    if (seen.has(hit.assetId)) continue
    seen.add(hit.assetId)
    merged.push(hit)
  }
  return merged.slice(0, limit)
}

export type ShotEmbeddingHit = {
  assetId: string
  shotId: string
  distance: number
}

/**
 * Per-shot embeddings (#515 text, #583 visual). Soft-fails to [] when the RPC,
 * rows, or query embed are missing so `find_moments` can fall back to tags/captions.
 * kind=text and kind=visual are different spaces — never mix the vectors.
 */
export const findShotEmbeddingsSemantic = async (input: {
  supabase: SupabaseClient
  productId: string
  query: string
  limit?: number
  useMock?: boolean
  modelId?: string
  maxDistance?: number
  kind?: 'text' | 'visual'
  queryVector?: VisualQueryVector
}): Promise<ShotEmbeddingHit[]> => {
  const query = input.query.trim()
  if (!query && !input.queryVector) return []
  const kind = input.kind ?? 'text'
  const limit = Math.max(1, Math.min(input.limit ?? 12, 50))
  const maxDistance =
    input.maxDistance ??
    (kind === 'visual' ? MAX_VISUAL_SEMANTIC_DISTANCE : MAX_TEXT_SEMANTIC_DISTANCE)

  try {
    let modelId: string
    let embedding: number[]
    let pgVector: string
    if (input.queryVector) {
      modelId = input.queryVector.modelId
      embedding = input.queryVector.embedding
      pgVector = input.queryVector.pgVector
    } else if (kind === 'visual') {
      const embedResult = await embedVisualQuery({
        query,
        useMock: input.useMock,
        modelId: input.modelId,
      })
      if (embedResult.skipped) return []
      modelId = embedResult.modelId
      embedding = embedResult.embedding
      pgVector = embedResult.pgVector
    } else {
      const embedResult = await embedAssetForIndex({
        caption: query,
        transcriptExcerpt: null,
        useMock: input.useMock,
        modelId: input.modelId?.trim() || ASSET_TEXT_EMBEDDING_MODEL_ID,
      })
      if (embedResult.skipped) return []
      modelId = embedResult.text.modelId
      embedding = embedResult.text.embedding
      pgVector = embedResult.text.pgVector
    }

    const { data: rpcRows, error: rpcError } = await input.supabase.rpc('match_shot_embeddings', {
      p_product_id: input.productId,
      p_query: pgVector,
      p_model_id: modelId,
      p_match_count: limit,
      p_kind: kind,
    })

    let ranked: ShotEmbeddingHit[] = []

    if (!rpcError && Array.isArray(rpcRows)) {
      ranked = rpcRows
        .map((row) => {
          const shotId = row.shot_id as string | null
          if (!shotId) return null
          return {
            assetId: row.asset_id as string,
            shotId,
            distance: typeof row.distance === 'number' ? row.distance : Number.POSITIVE_INFINITY,
          }
        })
        .filter((row): row is ShotEmbeddingHit => row != null)
    } else {
      const { data: embeddingRows, error } = await input.supabase
        .from('asset_embeddings')
        .select('asset_id, shot_id, embedding, model_id')
        .eq('product_id', input.productId)
        .eq('kind', kind)
        .eq('model_id', modelId)
        .not('shot_id', 'is', null)
      if (error) return []

      const parsed = (embeddingRows ?? [])
        .map((row) => {
          const shotId = row.shot_id as string | null
          const parsedEmbedding = parseVectorLiteral(row.embedding)
          if (!shotId || !parsedEmbedding) return null
          return { assetId: row.asset_id as string, shotId, embedding: parsedEmbedding }
        })
        .filter(
          (row): row is { assetId: string; shotId: string; embedding: number[] } => row != null,
        )

      ranked = rankByCosineDistance(embedding, parsed, limit).map((row) => ({
        assetId: row.assetId,
        shotId: row.shotId,
        distance: row.distance,
      }))
    }

    return filterByMaxDistance(ranked, maxDistance)
  } catch {
    return []
  }
}

/** Caption / tag / filename match — exact-ish queries when embeddings are sparse (#443/#445). */
export const findAssetsByKeyword = async (input: {
  supabase: SupabaseClient
  productId: string
  query: string
  limit?: number
}): Promise<AssetSearchHit[]> => {
  const query = input.query.trim()
  if (!query) return []
  const limit = Math.max(1, Math.min(input.limit ?? 12, 50))
  const safe = query.replace(/[%_]/g, '')
  if (!safe) return []
  const pattern = `%${safe}%`
  const tag = normalizeAssetTag(query)

  const [{ data: captionRows }, { data: tagRows }, { data: byBlob }, { data: byProbeName }] =
    await Promise.all([
      input.supabase
        .from('asset_index_state')
        .select('asset_id')
        .eq('product_id', input.productId)
        .eq('status', 'ready')
        .ilike('caption', pattern)
        .limit(limit),
      tag
        ? input.supabase
            .from('asset_tags')
            .select('asset_id')
            .eq('product_id', input.productId)
            .ilike('tag', pattern)
            .limit(limit)
        : Promise.resolve({ data: [] as Array<{ asset_id: string }> }),
      input.supabase
        .from('assets')
        .select('id')
        .eq('product_id', input.productId)
        .ilike('blob_key', pattern)
        .limit(limit),
      input.supabase
        .from('assets')
        .select('id')
        .eq('product_id', input.productId)
        .filter('probe->>name', 'ilike', pattern)
        .limit(limit),
    ])

  const ids = [
    ...new Set([
      ...(captionRows ?? []).map((row) => row.asset_id as string),
      ...(tagRows ?? []).map((row) => row.asset_id as string),
      ...(byBlob ?? []).map((row) => row.id as string),
      ...(byProbeName ?? []).map((row) => row.id as string),
    ]),
  ].slice(0, limit)

  return hydrateHits(
    input.supabase,
    input.productId,
    ids.map((assetId) => ({ assetId, distance: null })),
    { includeUnindexed: true },
  )
}

export const listAssetsByTag = async (input: {
  supabase: SupabaseClient
  productId: string
  tag: string
  prefix?: boolean
  limit?: number
}): Promise<AssetSearchHit[]> => {
  const normalized = normalizeAssetTag(input.tag)
  if (!normalized) return []
  const limit = Math.max(1, Math.min(input.limit ?? 24, 50))

  let query = input.supabase
    .from('asset_tags')
    .select('asset_id, tag')
    .eq('product_id', input.productId)
    .limit(limit)

  query = input.prefix ? query.ilike('tag', `${normalized}%`) : query.eq('tag', normalized)

  const { data: tagRows, error } = await query
  if (error) {
    throw new Error(`list_assets_by_tag failed: ${error.message}`)
  }
  const ids = [...new Set((tagRows ?? []).map((row) => row.asset_id as string))]
  return hydrateHits(
    input.supabase,
    input.productId,
    ids.map((assetId) => ({ assetId, distance: null })),
  )
}

export const describeAssetIndex = async (input: {
  supabase: SupabaseClient
  productId: string
  assetId: string
}): Promise<AssetDescription | null> => {
  const { data: state, error: stateError } = await input.supabase
    .from('asset_index_state')
    .select('*')
    .eq('asset_id', input.assetId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (stateError) {
    throw new Error(`describe_asset failed: ${stateError.message}`)
  }
  if (!state) return null

  const [{ data: tagRows }, { data: shotRows }] = await Promise.all([
    input.supabase
      .from('asset_tags')
      .select('tag')
      .eq('asset_id', input.assetId)
      .eq('product_id', input.productId),
    input.supabase
      .from('asset_shots')
      .select('id, ordinal, start_ms, end_ms, thumb_blob_key')
      .eq('asset_id', input.assetId)
      .eq('product_id', input.productId)
      .order('ordinal', { ascending: true }),
  ])

  return {
    assetId: state.asset_id as string,
    productId: state.product_id as string,
    status: state.status as string,
    stage: state.stage as string,
    caption: (state.caption as string | null) ?? null,
    transcriptExcerpt: (state.transcript_excerpt as string | null) ?? null,
    lastError: (state.last_error as string | null) ?? null,
    tags: (tagRows ?? []).map((row) => row.tag as string),
    shots: (shotRows ?? []).map((row) => ({
      id: row.id as string,
      ordinal: row.ordinal as number,
      startMs: row.start_ms as number,
      endMs: (row.end_ms as number | null) ?? null,
      thumbBlobKey: (row.thumb_blob_key as string | null) ?? null,
    })),
  }
}

/** Test helper — expose mock vector builder without importing embed internals elsewhere. */
export const queryVectorForTests = (text: string): { embedding: number[]; pgVector: string } => {
  const embedding = mockTextEmbedding(text)
  return { embedding, pgVector: formatPgVector(embedding) }
}
