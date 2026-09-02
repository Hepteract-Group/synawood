/** Wave 2J / #585 — persist analyze-on-index rows (ADR-0053). */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalyzeKind } from './analyze-schema'

export type PersistedAnalysis = {
  assetId: string
  productId: string
  shotId: string | null
  kind: AnalyzeKind
  schemaId: string
  result: Record<string, unknown>
  modelId: string
  startMs: number | null
  endMs: number | null
}

export type ListedAnalysis = {
  id: string
  assetId: string
  productId: string
  shotId: string | null
  kind: AnalyzeKind
  schemaId: string
  result: Record<string, unknown>
  modelId: string
  startMs: number | null
  endMs: number | null
  createdAt: string
  updatedAt: string
}

const mapAnalysisRow = (row: {
  id: string
  asset_id: string
  product_id: string
  shot_id: string | null
  kind: string
  schema_id: string
  result: unknown
  model_id: string
  start_ms: number | null
  end_ms: number | null
  created_at: string
  updated_at: string
}): ListedAnalysis => ({
  id: row.id,
  assetId: row.asset_id,
  productId: row.product_id,
  shotId: row.shot_id,
  kind: row.kind as AnalyzeKind,
  schemaId: row.schema_id,
  result:
    row.result && typeof row.result === 'object' && !Array.isArray(row.result)
      ? (row.result as Record<string, unknown>)
      : {},
  modelId: row.model_id,
  startMs: row.start_ms,
  endMs: row.end_ms,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const ANALYSIS_SELECT =
  'id, asset_id, product_id, shot_id, kind, schema_id, result, model_id, start_ms, end_ms, created_at, updated_at'

export const listAssetAnalyses = async (
  supabase: SupabaseClient,
  input: { productId: string; assetId: string; kind?: AnalyzeKind },
): Promise<ListedAnalysis[]> => {
  let query = supabase
    .from('asset_analyses')
    .select(ANALYSIS_SELECT)
    .eq('product_id', input.productId)
    .eq('asset_id', input.assetId)
    .order('updated_at', { ascending: false })

  if (input.kind) {
    query = query.eq('kind', input.kind)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list asset_analyses: ${error.message}`)
  }
  return (data ?? []).map((row) => mapAnalysisRow(row as Parameters<typeof mapAnalysisRow>[0]))
}

/** Product-scoped analyses for the assets already on this Studio Project. */
export const listAssetAnalysesForAssets = async (
  supabase: SupabaseClient,
  input: { productId: string; assetIds: readonly string[] },
): Promise<ListedAnalysis[]> => {
  const ids = [...new Set(input.assetIds.filter(Boolean))].slice(0, 40)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('asset_analyses')
    .select(ANALYSIS_SELECT)
    .eq('product_id', input.productId)
    .in('asset_id', ids)
    .order('updated_at', { ascending: false })
    .limit(80)

  if (error) {
    throw new Error(`Failed to list asset_analyses: ${error.message}`)
  }
  return (data ?? []).map((row) => mapAnalysisRow(row as Parameters<typeof mapAnalysisRow>[0]))
}

export const replaceAssetAnalysis = async (
  supabase: SupabaseClient,
  input: PersistedAnalysis,
): Promise<void> => {
  const { error: deleteError } = await supabase
    .from('asset_analyses')
    .delete()
    .eq('product_id', input.productId)
    .eq('asset_id', input.assetId)
    .eq('kind', input.kind)
    .eq('schema_id', input.schemaId)

  if (deleteError) {
    throw new Error(`Failed to clear asset_analyses: ${deleteError.message}`)
  }

  const { error: insertError } = await supabase.from('asset_analyses').insert({
    asset_id: input.assetId,
    product_id: input.productId,
    shot_id: input.shotId,
    kind: input.kind,
    schema_id: input.schemaId,
    result: input.result,
    model_id: input.modelId,
    start_ms: input.startMs,
    end_ms: input.endMs,
  })
  if (insertError) {
    throw new Error(`Failed to insert asset_analyses: ${insertError.message}`)
  }
}
