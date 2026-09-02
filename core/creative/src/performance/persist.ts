/** Persistence for outcomes + secrets (ADR-0035). Node / service-role only. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptSecret, readPerformanceTokenKey } from './encrypt'
import { isUnattributed, matchOutcome } from './match'
import type { OutcomeInput } from './schema'
import type { IntegrationProvider } from './schema'

type PublishRow = {
  id: string
  final_asset_id: string
  project_id: string | null
  external_url: string | null
}

export const listPublishRecordsForMatch = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<
  Array<{ id: string; finalAssetId: string; projectId: string | null; externalUrl: string | null }>
> => {
  const { data, error } = await supabase
    .from('publish_records')
    .select('id, final_asset_id, external_url')
    .eq('product_id', productId)
  if (error) throw new Error(`Could not load publish records: ${error.message}`)
  const rows = (data as PublishRow[] | null) ?? []
  const finalIds = [...new Set(rows.map((row) => row.final_asset_id).filter(Boolean))]
  const projectByFinal = new Map<string, string>()
  if (finalIds.length > 0) {
    const { data: finals, error: finalsError } = await supabase
      .from('final_assets')
      .select('id, project_id')
      .in('id', finalIds)
    if (finalsError) throw new Error(`Could not load Finals: ${finalsError.message}`)
    for (const row of (finals as Array<{ id: string; project_id: string }> | null) ?? []) {
      projectByFinal.set(row.id, row.project_id)
    }
  }
  return rows.map((row) => ({
    id: row.id,
    finalAssetId: row.final_asset_id,
    projectId: projectByFinal.get(row.final_asset_id) ?? null,
    externalUrl: row.external_url,
  }))
}

export type ManualOutcomeResult = {
  outcomeId: string | null
  unattributedId: string | null
  attributed: boolean
  refreshWarning: string | null
}

export const refreshCreativePerformance = async (
  supabase: SupabaseClient,
): Promise<string | null> => {
  // Outcome is already committed; a stale matview must not look like a failed save.
  const { error } = await supabase.rpc('refresh_creative_performance')
  if (!error) return null
  const message = `Outcome saved, but the performance table did not refresh: ${error.message}`
  console.error(message)
  return message
}

export const insertManualOutcome = async (
  supabase: SupabaseClient,
  productId: string,
  input: OutcomeInput,
): Promise<ManualOutcomeResult> => {
  const records = await listPublishRecordsForMatch(supabase, productId)
  let match = matchOutcome({
    publishRecordId: input.publishRecordId,
    finalAssetId: input.finalAssetId,
    projectId: input.projectId,
    externalUrl: input.externalUrl,
    records,
  })

  if (isUnattributed(match) && input.finalAssetId) {
    const final = await lookupFinalForProduct(supabase, productId, input.finalAssetId)
    if (final) {
      match = {
        publishRecordId: null,
        finalAssetId: final.id,
        projectId: input.projectId ?? final.projectId,
      }
    }
  }

  if (isUnattributed(match)) {
    const { data, error } = await supabase
      .from('unattributed_activity')
      .insert({
        product_id: productId,
        provider: 'manual',
        payload: input,
      })
      .select('id')
      .single()
    if (error) throw new Error(`Could not store unattributed activity: ${error.message}`)
    return {
      outcomeId: null,
      unattributedId: data.id as string,
      attributed: false,
      refreshWarning: null,
    }
  }

  const { data, error } = await supabase
    .from('outcomes')
    .insert({
      product_id: productId,
      source: 'manual',
      provider: 'manual',
      metric: input.metric,
      value: input.value,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      publish_record_id: match.publishRecordId,
      final_asset_id: match.finalAssetId,
      project_id: match.projectId,
      raw: { note: input.note ?? null, externalUrl: input.externalUrl ?? null },
    })
    .select('id')
    .single()
  if (error) throw new Error(`Could not save outcome: ${error.message}`)
  const refreshWarning = await refreshCreativePerformance(supabase)
  return {
    outcomeId: data.id as string,
    unattributedId: null,
    attributed: true,
    refreshWarning,
  }
}

const lookupFinalForProduct = async (
  supabase: SupabaseClient,
  productId: string,
  finalAssetId: string,
): Promise<{ id: string; projectId: string | null } | null> => {
  const { data, error } = await supabase
    .from('final_assets')
    .select('id, project_id')
    .eq('id', finalAssetId)
    .eq('product_id', productId)
    .maybeSingle()
  if (error) throw new Error(`Could not load Final: ${error.message}`)
  if (!data) return null
  return { id: data.id as string, projectId: (data.project_id as string | null) ?? null }
}

export const upsertIntegrationSecret = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    provider: IntegrationProvider
    token: string
    authKind?: 'token' | 'oauth'
  },
): Promise<void> => {
  const key = readPerformanceTokenKey()
  if (!key) {
    throw new Error(
      'PERFORMANCE_TOKEN_KEY is not set. Token paste is disabled until the operator adds it.',
    )
  }
  const sealed = encryptSecret(input.token, key)
  const { data: existing, error: findError } = await supabase
    .from('integrations')
    .select('id')
    .eq('product_id', input.productId)
    .eq('provider', input.provider)
    .maybeSingle()
  if (findError) throw new Error(`Could not load integration: ${findError.message}`)

  let integrationId = existing?.id as string | undefined
  if (!integrationId) {
    const { data, error } = await supabase
      .from('integrations')
      .insert({
        product_id: input.productId,
        provider: input.provider,
        status: 'connected',
        auth_kind: input.authKind ?? 'token',
      })
      .select('id')
      .single()
    if (error) throw new Error(`Could not create integration: ${error.message}`)
    integrationId = data.id as string
  } else {
    const { error } = await supabase
      .from('integrations')
      .update({
        status: 'connected',
        auth_kind: input.authKind ?? 'token',
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId)
    if (error) throw new Error(`Could not update integration: ${error.message}`)
  }

  const { error } = await supabase.from('integration_secrets').upsert({
    integration_id: integrationId,
    ciphertext: sealed.ciphertext,
    nonce: sealed.nonce,
    key_version: 1,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Could not store token: ${error.message}`)
}

export const listIntegrations = async (supabase: SupabaseClient, productId: string) => {
  const { data, error } = await supabase
    .from('integrations')
    .select(
      'id, provider, status, updated_at, last_pull_at, last_pull_reason, last_pull_row_count, auth_kind',
    )
    .eq('product_id', productId)
    .order('provider')
  if (error) throw new Error(`Could not load integrations: ${error.message}`)
  return data ?? []
}

export const listConnectedProductIds = async (supabase: SupabaseClient): Promise<string[]> => {
  const { data, error } = await supabase
    .from('integrations')
    .select('product_id')
    .eq('status', 'connected')
  if (error) throw new Error(`Could not list connected products: ${error.message}`)
  return [
    ...new Set(((data as Array<{ product_id: string }> | null) ?? []).map((row) => row.product_id)),
  ]
}

export const markIntegrationPull = async (
  supabase: SupabaseClient,
  input: { integrationId: string; reason: string; rowCount: number },
): Promise<void> => {
  const { error } = await supabase
    .from('integrations')
    .update({
      last_pull_at: new Date().toISOString(),
      last_pull_reason: input.reason,
      last_pull_row_count: input.rowCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.integrationId)
  if (error) throw new Error(`Could not stamp pull: ${error.message}`)
}

export const disconnectIntegration = async (
  supabase: SupabaseClient,
  input: { productId: string; provider: IntegrationProvider },
): Promise<void> => {
  const { data, error } = await supabase
    .from('integrations')
    .select('id')
    .eq('product_id', input.productId)
    .eq('provider', input.provider)
    .maybeSingle()
  if (error) throw new Error(`Could not load integration: ${error.message}`)
  const id = data?.id as string | undefined
  if (!id) return
  const { error: secretError } = await supabase
    .from('integration_secrets')
    .delete()
    .eq('integration_id', id)
  if (secretError) throw new Error(`Could not clear token: ${secretError.message}`)
  const { error: updateError } = await supabase
    .from('integrations')
    .update({
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updateError) throw new Error(`Could not disconnect: ${updateError.message}`)
}

export const listOutcomes = async (supabase: SupabaseClient, productId: string) => {
  const { data, error } = await supabase
    .from('outcomes')
    .select('id, metric, value, occurred_at, final_asset_id, source, provider')
    .eq('product_id', productId)
    .order('occurred_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(`Could not load outcomes: ${error.message}`)
  return data ?? []
}

export const listCreativePerformance = async (supabase: SupabaseClient, productId: string) => {
  const { data, error } = await supabase
    .from('creative_performance')
    .select(
      'final_asset_id, project_id, structure_source, beat_count, views, clicks, signups, revenue, outcome_count',
    )
    .eq('product_id', productId)
    .order('outcome_count', { ascending: false })
    .limit(50)
  if (error) throw new Error(`Could not load creative performance: ${error.message}`)
  return data ?? []
}

export const listUnattributed = async (supabase: SupabaseClient, productId: string) => {
  const { data, error } = await supabase
    .from('unattributed_activity')
    .select('id, provider, occurred_at, payload')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(`Could not load unattributed activity: ${error.message}`)
  return data ?? []
}
