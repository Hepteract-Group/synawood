import type {
  MarketplaceAdapter,
  MarketplaceKind,
  MarketplaceProviderId,
  MarketplacePurchaseInput,
  MarketplaceSearchQuery,
} from './types'

export class MarketplaceDisabledError extends Error {
  readonly code = 'MARKETPLACE_DISABLED' as const

  constructor() {
    super(
      'Marketplace adapters are disabled. Set MARKETPLACE_ADAPTERS=true to enable stubs (Wave 2G owns real purchase).',
    )
    this.name = 'MarketplaceDisabledError'
  }
}

export class MarketplaceNotImplementedError extends Error {
  readonly code = 'MARKETPLACE_NOT_IMPLEMENTED' as const

  constructor(action: 'search' | 'purchase', providerId: MarketplaceProviderId) {
    super(
      `Marketplace ${action} is not implemented for ${providerId} (Wave 2G). Stubs never call vendor networks.`,
    )
    this.name = 'MarketplaceNotImplementedError'
  }
}

const STUB_KINDS: Record<MarketplaceProviderId, readonly MarketplaceKind[]> = {
  envato: ['stock_image', 'stock_video', 'stock_audio'],
  artlist: ['stock_video', 'stock_audio'],
  adobe_stock: ['stock_image', 'stock_video'],
}

const STUB_LABELS: Record<MarketplaceProviderId, string> = {
  envato: 'Envato (stub)',
  artlist: 'Artlist (stub)',
  adobe_stock: 'Adobe Stock (stub)',
}

const createStubAdapter = (providerId: MarketplaceProviderId): MarketplaceAdapter => ({
  providerId,
  label: STUB_LABELS[providerId],
  kinds: STUB_KINDS[providerId],
  search: async (_query: MarketplaceSearchQuery) => {
    throw new MarketplaceNotImplementedError('search', providerId)
  },
  purchase: async (_input: MarketplacePurchaseInput) => {
    throw new MarketplaceNotImplementedError('purchase', providerId)
  },
})

/** Placeholder adapters — never perform network purchase. */
export const MARKETPLACE_STUB_ADAPTERS: readonly MarketplaceAdapter[] = [
  createStubAdapter('envato'),
  createStubAdapter('artlist'),
  createStubAdapter('adobe_stock'),
]
