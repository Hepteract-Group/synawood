/** Commerce adapters (ADR-0035 / #241). v1 is stub — no live network. */

import type { AdapterPullResult } from './schema'
import { commerceProviderSchema, type IntegrationProvider } from './schema'

export const pullCommerce = (input: {
  provider: IntegrationProvider
  connected: boolean
}): AdapterPullResult => {
  const parsed = commerceProviderSchema.safeParse(input.provider)
  if (!parsed.success) {
    return { ok: true, rows: [], reason: 'not_connected' }
  }
  if (!input.connected) {
    return { ok: true, rows: [], reason: 'not_connected' }
  }
  return { ok: true, rows: [], reason: 'stub_provider' }
}
