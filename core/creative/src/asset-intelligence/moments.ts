/** #513 — shot-level Moment retrieval for B-roll (ADR-0047). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeAssetTag } from './caption'
import {
  MAX_TEXT_SEMANTIC_DISTANCE,
  MAX_VISUAL_SEMANTIC_DISTANCE,
  findShotEmbeddingsSemantic,
  loadStoredVisualQueryVector,
} from './search'
import { getBlobBytes as getBlobBytesDefault, type BlobEnv } from '../persistence/blob'
import { embedShotVisualForIndex } from './embed-shot-visual'
import { CI_STUB_VISUAL_EMBEDDING_MODEL_ID } from '../model-profiles/embed-visual'
import { highlightScoresFromResult } from './highlight-pack'
import type { VisualQueryVector } from './visual-query-vector'
import {
  RRF_KEYWORD_WEIGHT,
  RRF_TEXT_WEIGHT,
  RRF_VISUAL_WEIGHT,
  reciprocalRankFusion,
} from './fuse-moment-ranks'
import {
  shotWindowContainsPhrase,
  transcriptWindowForShot,
  type TranscriptSegment,
} from './transcript'

export type MomentCandidate = {
  assetId: string
  shotId: string
  startMs: number
  endMs: number | null
  caption: string | null
  transcriptExcerpt: string | null
  tags: string[]
}

export type MomentHit = {
  assetId: string
  shotId: string
  startMs: number
  endMs: number | null
  score: number
  caption: string | null
  transcriptExcerpt: string | null
  tags: string[]
}

const tokenize = (raw: string): string[] =>
  raw
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)

const haystackHas = (haystack: string, needle: string): boolean =>
  haystack.includes(needle.toLowerCase())

const shotDurationMs = (candidate: MomentCandidate): number | null => {
  if (candidate.endMs == null) return null
  return Math.max(0, candidate.endMs - candidate.startMs)
}

export const scoreMoment = (
  query: string,
  candidate: MomentCandidate,
  filters?: { tag?: string; sceneRole?: string },
): number | null => {
  const tagFilter = filters?.tag ? normalizeAssetTag(filters.tag) : null
  if (tagFilter && !candidate.tags.some((tag) => tag === tagFilter || tag.includes(tagFilter))) {
    return null
  }
  const role = filters?.sceneRole?.trim().toLowerCase()
  if (role) {
    const roleHay =
      `${candidate.tags.join(' ')} ${candidate.caption ?? ''} ${candidate.transcriptExcerpt ?? ''}`.toLowerCase()
    if (!haystackHas(roleHay, role)) return null
  }

  const q = query.trim().toLowerCase()
  if (!q) return null
  const caption = (candidate.caption ?? '').toLowerCase()
  const transcript = (candidate.transcriptExcerpt ?? '').toLowerCase()
  const tags = candidate.tags.map((tag) => tag.toLowerCase())
  const tagBlob = tags.join(' ')
  const tokens = tokenize(q)
  let score = 0

  if (haystackHas(`${caption} ${transcript} ${tagBlob}`, q)) score += 4
  if (shotWindowContainsPhrase(candidate.transcriptExcerpt, query)) score += 6
  for (const token of tokens) {
    if (tags.some((tag) => tag === token || tag.includes(token))) score += 3
    if (haystackHas(caption, token)) score += 2
    if (haystackHas(transcript, token)) score += 1
  }

  const duration = shotDurationMs(candidate)
  if (duration != null && duration > 0 && duration <= 4_000) score += 1
  if (duration != null && duration >= 20_000) score -= 2

  return score > 0 ? score : null
}

export const rankMoments = (input: {
  query: string
  candidates: readonly MomentCandidate[]
  tag?: string
  sceneRole?: string
  limit?: number
  distanceByShot?: ReadonlyMap<string, number>
  visualDistanceByShot?: ReadonlyMap<string, number>
  highlightScoreByShot?: ReadonlyMap<string, number>
}): MomentHit[] => {
  const limit = Math.max(1, Math.min(input.limit ?? 12, 50))
  const byId = new Map(input.candidates.map((candidate) => [candidate.shotId, candidate]))
  const keywordHits = input.candidates
    .map((candidate) => {
      const score = scoreMoment(input.query, candidate, {
        tag: input.tag,
        sceneRole: input.sceneRole,
      })
      return score == null ? null : { shotId: candidate.shotId, score }
    })
    .filter((row): row is { shotId: string; score: number } => row != null)
    .sort((left, right) => right.score - left.score)

  const emptyDistances: Array<[string, number]> = []
  const textHits = [...(input.distanceByShot ?? emptyDistances)]
    .filter(([, distance]) => distance <= MAX_TEXT_SEMANTIC_DISTANCE)
    .sort((left, right) => left[1] - right[1])
    .filter(([shotId]) => byId.has(shotId))
    .map(([shotId]) => ({ shotId }))

  const visualHits = [...(input.visualDistanceByShot ?? emptyDistances)]
    .filter(([, distance]) => distance <= MAX_VISUAL_SEMANTIC_DISTANCE)
    .sort((left, right) => left[1] - right[1])
    .filter(([shotId]) => byId.has(shotId))
    .map(([shotId]) => ({ shotId }))

  const fused = reciprocalRankFusion([
    { weight: RRF_VISUAL_WEIGHT, hits: visualHits },
    { weight: RRF_TEXT_WEIGHT, hits: textHits },
    { weight: RRF_KEYWORD_WEIGHT, hits: keywordHits },
  ])

  const keywordScore = new Map(keywordHits.map((hit) => [hit.shotId, hit.score]))

  return [...fused.entries()]
    .map(([shotId, rrf]) => {
      const candidate = byId.get(shotId)
      if (!candidate) return null
      return {
        assetId: candidate.assetId,
        shotId: candidate.shotId,
        startMs: candidate.startMs,
        endMs: candidate.endMs,
        score: rrf + (input.highlightScoreByShot?.get(shotId) ?? 0),
        caption: candidate.caption,
        transcriptExcerpt: candidate.transcriptExcerpt,
        tags: candidate.tags,
      }
    })
    .filter((hit): hit is MomentHit => hit != null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      const keywordDelta =
        (keywordScore.get(right.shotId) ?? 0) - (keywordScore.get(left.shotId) ?? 0)
      if (keywordDelta !== 0) return keywordDelta
      const leftDur = (left.endMs ?? left.startMs) - left.startMs
      const rightDur = (right.endMs ?? right.startMs) - right.startMs
      if (leftDur !== rightDur) return leftDur - rightDur
      return left.startMs - right.startMs
    })
    .slice(0, limit)
}

export const findMoments = async (input: {
  supabase: SupabaseClient
  productId: string
  query: string
  tag?: string
  sceneRole?: string
  limit?: number
  useMock?: boolean
  sort?: 'relevance' | 'highlight'
  imageAssetId?: string
  blobEnv?: BlobEnv
  getBlobBytes?: typeof getBlobBytesDefault
}): Promise<MomentHit[]> => {
  const query = input.query.trim()
  if (!query && !input.imageAssetId) return []

  const { data: states, error: stateError } = await input.supabase
    .from('asset_index_state')
    .select('asset_id, caption, transcript_excerpt, transcript_segments, status')
    .eq('product_id', input.productId)
    .eq('status', 'ready')

  if (stateError) {
    throw new Error(`find_moments failed: ${stateError.message}`)
  }
  const ready = states ?? []
  if (ready.length === 0) return []

  const ids = ready.map((row) => row.asset_id as string)
  const [{ data: shotRows, error: shotError }, { data: tagRows, error: tagError }] =
    await Promise.all([
      input.supabase
        .from('asset_shots')
        .select('id, asset_id, start_ms, end_ms')
        .eq('product_id', input.productId)
        .in('asset_id', ids),
      input.supabase
        .from('asset_tags')
        .select('asset_id, tag')
        .eq('product_id', input.productId)
        .in('asset_id', ids),
    ])

  if (shotError) {
    throw new Error(`find_moments failed: ${shotError.message}`)
  }
  if (tagError) {
    throw new Error(`find_moments failed: ${tagError.message}`)
  }
  if (!shotRows || shotRows.length === 0) return []

  const tagsByAsset = new Map<string, string[]>()
  for (const row of tagRows ?? []) {
    const assetId = row.asset_id as string
    const list = tagsByAsset.get(assetId) ?? []
    list.push(row.tag as string)
    tagsByAsset.set(assetId, list)
  }
  const stateByAsset = new Map(
    ready.map((row) => [
      row.asset_id as string,
      {
        caption: (row.caption as string | null) ?? null,
        transcriptExcerpt: (row.transcript_excerpt as string | null) ?? null,
        segments: Array.isArray(row.transcript_segments)
          ? (row.transcript_segments as TranscriptSegment[])
          : [],
      },
    ]),
  )

  const candidates: MomentCandidate[] = shotRows.flatMap((row) => {
    const assetId = row.asset_id as string
    const state = stateByAsset.get(assetId)
    if (!state) return []
    const startMs = row.start_ms as number
    const endMs = (row.end_ms as number | null) ?? null
    const window =
      state.segments.length > 0
        ? transcriptWindowForShot({ startMs, endMs }, state.segments)
        : state.transcriptExcerpt
    return [
      {
        assetId,
        shotId: row.id as string,
        startMs,
        endMs,
        caption: state.caption,
        transcriptExcerpt: window,
        tags: tagsByAsset.get(assetId) ?? [],
      },
    ]
  })

  let distanceByShot: Map<string, number> | undefined
  let visualDistanceByShot: Map<string, number> | undefined
  try {
    const [textHits, visualHits] = await Promise.all([
      query
        ? findShotEmbeddingsSemantic({
            supabase: input.supabase,
            productId: input.productId,
            query,
            limit: input.limit,
            useMock: input.useMock,
            kind: 'text',
          })
        : Promise.resolve([]),
      (async () => {
        const queryVector = await resolveVisualQueryVector({
          supabase: input.supabase,
          productId: input.productId,
          imageAssetId: input.imageAssetId,
          blobEnv: input.blobEnv,
          useMock: input.useMock === true,
          getBlobBytes: input.getBlobBytes,
        })
        if (input.imageAssetId && !queryVector) return []
        if (!queryVector && !isVisualTextQuery(query)) return []
        return findShotEmbeddingsSemantic({
          supabase: input.supabase,
          productId: input.productId,
          query,
          limit: input.limit,
          useMock: input.useMock,
          kind: 'visual',
          queryVector: queryVector ?? undefined,
        })
      })(),
    ])
    if (textHits.length > 0) {
      distanceByShot = new Map(textHits.map((hit) => [hit.shotId, hit.distance]))
    }
    if (visualHits.length > 0) {
      visualDistanceByShot = new Map(visualHits.map((hit) => [hit.shotId, hit.distance]))
    }
  } catch {
    distanceByShot = undefined
    visualDistanceByShot = undefined
  }

  return rankMoments({
    query,
    candidates,
    tag: input.tag,
    sceneRole: input.sceneRole,
    limit: input.limit,
    distanceByShot,
    visualDistanceByShot,
    highlightScoreByShot: await loadHighlightScores({
      ...input,
      shots: candidates.map((candidate) => ({
        id: candidate.shotId,
        startMs: candidate.startMs,
        endMs: candidate.endMs,
      })),
    }),
  })
}

const ASSET_ID_QUERY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Text may enter the visual embedder; UUIDs and the old “similar” fallback must not. */
const isVisualTextQuery = (query: string): boolean => {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (trimmed.toLowerCase() === 'similar') return false
  if (ASSET_ID_QUERY.test(trimmed)) return false
  return true
}

const resolveVisualQueryVector = async (input: {
  supabase: SupabaseClient
  productId: string
  imageAssetId?: string
  blobEnv?: BlobEnv
  useMock: boolean
  getBlobBytes?: typeof getBlobBytesDefault
}): Promise<VisualQueryVector | null> => {
  if (!input.imageAssetId) return null
  if (input.blobEnv) {
    const { data: asset } = await input.supabase
      .from('assets')
      .select('blob_key')
      .eq('product_id', input.productId)
      .eq('id', input.imageAssetId)
      .maybeSingle()
    const blobKey = typeof asset?.blob_key === 'string' ? asset.blob_key : ''
    if (blobKey) {
      const getBytes = input.getBlobBytes ?? getBlobBytesDefault
      const thumbBytes = await getBytes({
        blobEnv: input.blobEnv,
        blobKey,
      })
      const visual = await embedShotVisualForIndex({
        thumbBytes,
        seed: input.imageAssetId,
        useMock: input.useMock,
        modelId: input.useMock ? CI_STUB_VISUAL_EMBEDDING_MODEL_ID : '',
      })
      if (!visual.skipped) {
        return { embedding: visual.embedding, pgVector: visual.pgVector, modelId: visual.modelId }
      }
    }
  }
  return loadStoredVisualQueryVector({
    supabase: input.supabase,
    productId: input.productId,
    assetId: input.imageAssetId,
  })
}

const loadHighlightScores = async (input: {
  supabase: SupabaseClient
  productId: string
  sort?: 'relevance' | 'highlight'
  shots: Array<{ id: string; startMs: number; endMs: number | null }>
}): Promise<Map<string, number> | undefined> => {
  if (input.sort !== 'highlight') return undefined
  const { data, error } = await input.supabase
    .from('asset_analyses')
    .select('shot_id, result')
    .eq('product_id', input.productId)
    .eq('kind', 'highlight')
  if (error || !data || data.length === 0) return undefined
  const scores = new Map<string, number>()
  for (const row of data) {
    const shotId = (row.shot_id as string | null) ?? ''
    const result =
      row.result && typeof row.result === 'object' && !Array.isArray(row.result)
        ? (row.result as Record<string, unknown>)
        : {}
    const nested = highlightScoresFromResult(result, input.shots)
    for (const [id, score] of nested) scores.set(id, score)
    const direct = Number(result.score)
    if (shotId && Number.isFinite(direct) && !scores.has(shotId)) scores.set(shotId, direct)
  }
  return scores.size > 0 ? scores : undefined
}
