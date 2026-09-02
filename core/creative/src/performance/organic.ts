/** Organic adapters (ADR-0035 / #240). v1 is stub — no live network. */

import type { AdapterPullResult } from './schema'
import { organicProviderSchema, type IntegrationProvider } from './schema'

export const pullOrganic = (input: {
  provider: IntegrationProvider
  connected: boolean
}): AdapterPullResult => {
  const parsed = organicProviderSchema.safeParse(input.provider)
  if (!parsed.success) {
    return { ok: true, rows: [], reason: 'not_connected' }
  }
  if (!input.connected) {
    return { ok: true, rows: [], reason: 'not_connected' }
  }
  return { ok: true, rows: [], reason: 'stub_provider' }
}
