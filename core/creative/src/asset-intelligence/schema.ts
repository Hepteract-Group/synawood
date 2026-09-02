/** Wave 2C / ADR-0032 — asset intelligence DTOs (schema #163, no pipeline yet). */

import { z } from 'zod'

export const ASSET_EMBEDDING_DIMS = 1536 as const

export const assetIndexStatusSchema = z.enum(['pending', 'indexing', 'ready', 'failed'])
export type AssetIndexStatus = z.infer<typeof assetIndexStatusSchema>

export const assetIndexStageSchema = z.enum([
  'queued',
  'probe',
  'shots',
  'caption',
  'transcribe',
  'embed',
  'analyze',
  'ready',
  'failed',
])
export type AssetIndexStage = z.infer<typeof assetIndexStageSchema>

export const assetTagSourceSchema = z.enum(['caption', 'manual', 'heuristic'])
export type AssetTagSource = z.infer<typeof assetTagSourceSchema>

export const assetEmbeddingKindSchema = z.enum(['text', 'visual'])
export type AssetEmbeddingKind = z.infer<typeof assetEmbeddingKindSchema>

export const transcriptSegmentSchema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string(),
})

export const assetIndexStateSchema = z
  .object({
    assetId: z.string().uuid(),
    productId: z.string().min(1),
    status: assetIndexStatusSchema,
    stage: assetIndexStageSchema,
    caption: z.string().nullable(),
    transcriptExcerpt: z.string().nullable(),
    transcriptSegments: z.array(transcriptSegmentSchema).default([]),
    lastError: z.string().nullable(),
    faceDetectRan: z.boolean(),
    indexedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type AssetIndexState = z.infer<typeof assetIndexStateSchema>

export const assetShotSchema = z
  .object({
    id: z.string().uuid(),
    assetId: z.string().uuid(),
    productId: z.string().min(1),
    ordinal: z.number().int().min(0),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0).nullable(),
    thumbBlobKey: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.endMs != null && value.endMs < value.startMs) {
      ctx.addIssue({
        code: 'custom',
        message: 'endMs must be >= startMs',
        path: ['endMs'],
      })
    }
  })

export type AssetShot = z.infer<typeof assetShotSchema>

export const assetTagSchema = z
  .object({
    assetId: z.string().uuid(),
    productId: z.string().min(1),
    tag: z.string().trim().min(1).max(64),
    source: assetTagSourceSchema,
    createdAt: z.string().datetime(),
  })
  .strict()

export type AssetTag = z.infer<typeof assetTagSchema>

export const assetEmbeddingMetaSchema = z
  .object({
    id: z.string().uuid(),
    assetId: z.string().uuid(),
    productId: z.string().min(1),
    shotId: z.string().uuid().nullable(),
    kind: assetEmbeddingKindSchema,
    modelId: z.string().min(1),
    /** Vector length must match ASSET_EMBEDDING_DIMS (DB vector(1536)). */
    dims: z.literal(ASSET_EMBEDDING_DIMS),
    createdAt: z.string().datetime(),
  })
  .strict()

export type AssetEmbeddingMeta = z.infer<typeof assetEmbeddingMetaSchema>

export const parseAssetIndexState = (input: unknown): AssetIndexState =>
  assetIndexStateSchema.parse(input)

export const parseAssetShot = (input: unknown): AssetShot => assetShotSchema.parse(input)

export const parseAssetTag = (input: unknown): AssetTag => assetTagSchema.parse(input)

export const parseAssetEmbeddingMeta = (input: unknown): AssetEmbeddingMeta =>
  assetEmbeddingMetaSchema.parse(input)

/** Coerce Postgres/Supabase timestamptz strings into Zod-friendly `…Z` ISO. */
export const toIsoDateTime = (value: string): string => {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid timestamp: ${value}`)
  }
  return new Date(ms).toISOString()
}

const toIsoDateTimeOrNull = (value: string | null): string | null =>
  value == null ? null : toIsoDateTime(value)

/** Map a DB row (snake_case) into AssetIndexState. */
export const assetIndexStateFromRow = (row: {
  asset_id: string
  product_id: string
  status: string
  stage: string
  caption: string | null
  transcript_excerpt: string | null
  transcript_segments?: unknown
  last_error: string | null
  face_detect_ran: boolean
  indexed_at: string | null
  created_at: string
  updated_at: string
}): AssetIndexState =>
  parseAssetIndexState({
    assetId: row.asset_id,
    productId: row.product_id,
    status: row.status,
    stage: row.stage,
    caption: row.caption,
    transcriptExcerpt: row.transcript_excerpt,
    transcriptSegments: Array.isArray(row.transcript_segments) ? row.transcript_segments : [],
    lastError: row.last_error,
    faceDetectRan: row.face_detect_ran,
    indexedAt: toIsoDateTimeOrNull(row.indexed_at),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  })
