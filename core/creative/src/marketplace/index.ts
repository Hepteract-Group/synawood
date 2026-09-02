import { isMarketplaceAdaptersEnabled } from './flag'
import {
  MARKETPLACE_STUB_ADAPTERS,
  MarketplaceDisabledError,
  MarketplaceNotImplementedError,
} from './stubs'
import type { MarketplaceAdapter, MarketplaceProviderId } from './types'

export {
  isMarketplaceAdaptersEnabled,
  MARKETPLACE_STUB_ADAPTERS,
  MarketplaceDisabledError,
  MarketplaceNotImplementedError,
}
export { MARKETPLACE_KINDS, MARKETPLACE_PROVIDER_IDS } from './types'
export type {
  MarketplaceAdapter,
  MarketplaceKind,
  MarketplaceProviderId,
  MarketplacePurchaseInput,
  MarketplacePurchaseResult,
  MarketplaceSearchHit,
  MarketplaceSearchQuery,
} from './types'

/**
 * Adapters available when MARKETPLACE_ADAPTERS is on.
 * Empty when the flag is off so callers can gate UI without throwing.
 */
export const listMarketplaceAdapters = (
  env: NodeJS.ProcessEnv = process.env,
): readonly MarketplaceAdapter[] => {
  if (!isMarketplaceAdaptersEnabled(env)) return []
  return MARKETPLACE_STUB_ADAPTERS
}

/** Throws MarketplaceDisabledError when the flag is off. */
export const requireMarketplaceAdapters = (
  env: NodeJS.ProcessEnv = process.env,
): readonly MarketplaceAdapter[] => {
  if (!isMarketplaceAdaptersEnabled(env)) {
    throw new MarketplaceDisabledError()
  }
  return MARKETPLACE_STUB_ADAPTERS
}

export const getMarketplaceAdapter = (
  providerId: MarketplaceProviderId,
  env: NodeJS.ProcessEnv = process.env,
): MarketplaceAdapter | null =>
  listMarketplaceAdapters(env).find((adapter) => adapter.providerId === providerId) ?? null
