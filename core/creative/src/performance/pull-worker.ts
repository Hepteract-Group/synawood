/** Analytics pull worker (ADR-0035 / #245). Adapters stay stub until live OAuth spend is approved. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { pullCommerce } from './commerce'
import { pullOrganic } from './organic'
import { listConnectedProductIds, listIntegrations, markIntegrationPull } from './persist'
import type { AdapterPullResult, IntegrationProvider } from './schema'

export type PullProviderResult = {
  productId: string
  provider: string
  reason: AdapterPullResult['reason'] | 'skipped'
  rowCount: number
}

const isOrganic = (provider: string): boolean =>
  provider === 'tiktok' || provider === 'meta' || provider === 'youtube' || provider === 'linkedin'

const isCommerce = (provider: string): boolean => provider === 'shopify' || provider === 'stripe'

export const pullOneProvider = (input: {
  provider: IntegrationProvider
  connected: boolean
}): AdapterPullResult => {
  if (isCommerce(input.provider)) {
    return pullCommerce({ provider: input.provider, connected: input.connected })
  }
  if (isOrganic(input.provider)) {
    return pullOrganic({ provider: input.provider, connected: input.connected })
  }
  return { ok: true, rows: [], reason: 'not_connected' }
}

export const runPerformancePullForProduct = async (input: {
  supabase: SupabaseClient
  productId: string
}): Promise<PullProviderResult[]> => {
  const integrations = await listIntegrations(input.supabase, input.productId)
  const results: PullProviderResult[] = []
  for (const row of integrations) {
    const connected = row.status === 'connected'
    const pulled = pullOneProvider({
      provider: row.provider as IntegrationProvider,
      connected,
    })
    await markIntegrationPull(input.supabase, {
      integrationId: row.id,
      reason: pulled.reason,
      rowCount: Array.isArray(pulled.rows) ? pulled.rows.length : 0,
    })
    results.push({
      productId: input.productId,
      provider: row.provider,
      reason: pulled.reason,
      rowCount: Array.isArray(pulled.rows) ? pulled.rows.length : 0,
    })
  }
  return results
}

export const runPerformancePullJob = async (input: {
  supabase: SupabaseClient
  productId?: string
}): Promise<{ products: number; results: PullProviderResult[] }> => {
  const productIds = input.productId
    ? [input.productId]
    : await listConnectedProductIds(input.supabase)
  const results: PullProviderResult[] = []
  for (const productId of productIds) {
    results.push(...(await runPerformancePullForProduct({ supabase: input.supabase, productId })))
  }
  return { products: productIds.length, results }
}
