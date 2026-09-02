export type ProductExtractKind = 'screenshot' | 'still' | 'text'
export type ProductExtractQuality = 'usable' | 'weak' | 'reject'

export type ProductExtract = {
  id: string
  productId: string
  kind: ProductExtractKind
  sourceUrl: string
  blobKey?: string
  text?: string
  quality: ProductExtractQuality
  qualityNote?: string
  jobId?: string
  createdAt: string
  updatedAt: string
}

export type ProductExtractRow = {
  id: string
  product_id: string
  kind: ProductExtractKind
  source_url: string
  blob_key: string | null
  text: string | null
  quality: ProductExtractQuality
  quality_note: string | null
  job_id: string | null
  created_at: string
  updated_at: string
}

export const productExtractFromRow = (row: ProductExtractRow): ProductExtract => ({
  id: row.id,
  productId: row.product_id,
  kind: row.kind,
  sourceUrl: row.source_url,
  blobKey: row.blob_key ?? undefined,
  text: row.text ?? undefined,
  quality: row.quality,
  qualityNote: row.quality_note ?? undefined,
  jobId: row.job_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const EXTRACT_SELECT =
  'id, product_id, kind, source_url, blob_key, text, quality, quality_note, job_id, created_at, updated_at'

export const productExtractSelect = (): string => EXTRACT_SELECT
