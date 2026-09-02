/** Insight persistence + worker (ADR-0036). Node / service-role only. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { runAnalyses, type LearningRow } from './analyses'
import { mergePriors } from './merge'
import { loadPriors, writeLocalPriorsBestEffort } from './priors'
import type { InsightKind, InsightStatus, SkillPriors } from './schema'

type StructureBeat = { kind?: string; durationInFrames?: number }

const toLearningRows = (
  performance: Array<{
    final_asset_id: string
    beat_count: number
    views: number
    clicks: number
    signups: number
    revenue: number
  }>,
  structures: Map<string, StructureBeat[]>,
): LearningRow[] =>
  performance.map((row) => ({
    finalAssetId: row.final_asset_id,
    beatCount: Number(row.beat_count) || 0,
    views: Number(row.views) || 0,
    clicks: Number(row.clicks) || 0,
    signups: Number(row.signups) || 0,
    revenue: Number(row.revenue) || 0,
    beats: (structures.get(row.final_asset_id) ?? []).map((beat) => ({
      kind: typeof beat.kind === 'string' ? beat.kind : 'hook',
      durationInFrames: Number(beat.durationInFrames) || 1,
    })),
  }))

export const listInsights = async (
  supabase: SupabaseClient,
  productId: string,
  status?: InsightStatus,
) => {
  let query = supabase
    .from('insights')
    .select(
      'id, kind, status, title, body, evidence, proposed_prior, applied_prior, snooze_until, created_at',
    )
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error(`Could not load insights: ${error.message}`)
  return data ?? []
}

export const runLearningWorker = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<{ inserted: number; skipped: number }> => {
  const { data: performance, error: perfError } = await supabase
    .from('creative_performance')
    .select('final_asset_id, beat_count, views, clicks, signups, revenue')
    .eq('product_id', productId)
    .limit(100)
  if (perfError) throw new Error(`Could not load creative performance: ${perfError.message}`)
  const rows = performance ?? []
  const ids = rows.map((row) => row.final_asset_id as string)
  const structures = new Map<string, StructureBeat[]>()
  if (ids.length > 0) {
    const { data: finals, error: finalsError } = await supabase
      .from('final_assets')
      .select('id, creative_structure')
      .in('id', ids)
    if (finalsError) throw new Error(`Could not load Final structure: ${finalsError.message}`)
    for (const row of finals ?? []) {
      const beats = (row.creative_structure as { beats?: StructureBeat[] } | null)?.beats ?? []
      structures.set(row.id as string, beats)
    }
  }

  const drafts = runAnalyses(toLearningRows(rows, structures))
  const open = await listInsights(supabase, productId, 'open')
  const openKinds = new Set(open.map((row) => row.kind as InsightKind))
  let inserted = 0
  let skipped = 0
  for (const draft of drafts) {
    if (openKinds.has(draft.kind)) {
      skipped += 1
      continue
    }
    const { error } = await supabase.from('insights').insert({
      product_id: productId,
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      evidence: draft.evidence,
      proposed_prior: draft.proposedPrior,
    })
    if (error) throw new Error(`Could not save insight: ${error.message}`)
    inserted += 1
  }
  return { inserted, skipped }
}

export const applyInsight = async (
  supabase: SupabaseClient,
  input: { productId: string; insightId: string; repoRoot?: string },
): Promise<{ priors: SkillPriors; wroteLocalFile: boolean }> => {
  const { data, error } = await supabase
    .from('insights')
    .select('id, status, proposed_prior')
    .eq('id', input.insightId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (error) throw new Error(`Could not load insight: ${error.message}`)
  if (!data) throw new Error('Insight not found.')
  if (data.status !== 'open' && data.status !== 'snoozed') {
    throw new Error('Only open or snoozed insights can be applied.')
  }
  const loaded = await loadPriors({ productId: input.productId, repoRoot: input.repoRoot })
  const merged = mergePriors(loaded.priors, data.proposed_prior)
  const wroteLocalFile = await writeLocalPriorsBestEffort(input.productId, merged, input.repoRoot)
  const { error: updateError } = await supabase
    .from('insights')
    .update({
      status: 'applied',
      applied_prior: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.insightId)
    .eq('product_id', input.productId)
  if (updateError) throw new Error(`Could not apply insight: ${updateError.message}`)
  return { priors: merged, wroteLocalFile }
}

export const dismissInsight = async (
  supabase: SupabaseClient,
  input: { productId: string; insightId: string },
): Promise<void> => {
  const { error } = await supabase
    .from('insights')
    .update({ status: 'dismissed', updated_at: new Date().toISOString() })
    .eq('id', input.insightId)
    .eq('product_id', input.productId)
  if (error) throw new Error(`Could not dismiss insight: ${error.message}`)
}

export const snoozeInsight = async (
  supabase: SupabaseClient,
  input: { productId: string; insightId: string; snoozeDays?: number },
): Promise<void> => {
  const days = input.snoozeDays ?? 7
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('insights')
    .update({
      status: 'snoozed',
      snooze_until: until,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.insightId)
    .eq('product_id', input.productId)
  if (error) throw new Error(`Could not snooze insight: ${error.message}`)
}
