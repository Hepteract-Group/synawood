/**
 * Marketplace adapters — Wave 2B placeholders only (ADR-0027 §6, #153).
 * Real purchase / billing is Wave 2G. Until then everything is gated by
 * MARKETPLACE_ADAPTERS and stubs never call a vendor network.
 */

export const MARKETPLACE_KINDS = ['stock_image', 'stock_video', 'stock_audio'] as const
export type MarketplaceKind = (typeof MARKETPLACE_KINDS)[number]

export const MARKETPLACE_PROVIDER_IDS = ['envato', 'artlist', 'adobe_stock'] as const
export type MarketplaceProviderId = (typeof MARKETPLACE_PROVIDER_IDS)[number]

export type MarketplaceSearchQuery = {
  kind: MarketplaceKind
  query: string
  limit?: number
}

export type MarketplaceSearchHit = {
  id: string
  providerId: MarketplaceProviderId
  kind: MarketplaceKind
  title: string
  previewUrl?: string
  /** Display-only — never a real charge in v1 stubs. */
  estimatedGbp?: number
}

export type MarketplacePurchaseInput = {
  providerId: MarketplaceProviderId
  assetId: string
  projectId: string
}

export type MarketplacePurchaseResult = {
  providerId: MarketplaceProviderId
  assetId: string
  blobKey: string
}

/**
 * Product-agnostic marketplace port. UI/tools call this — never vendor SDKs directly.
 */
export type MarketplaceAdapter = {
  providerId: MarketplaceProviderId
  label: string
  kinds: readonly MarketplaceKind[]
  search: (query: MarketplaceSearchQuery) => Promise<MarketplaceSearchHit[]>
  /**
   * License / download. Stubs always reject — Wave 2G implements billing + blob write.
   */
  purchase: (input: MarketplacePurchaseInput) => Promise<MarketplacePurchaseResult>
}
