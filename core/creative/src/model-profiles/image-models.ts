/** Vercel AI Gateway image models — switchable via Model Profiles. */

export type GatewayImageModel = {
  profileId: string
  label: string
  description: string
  /** Gateway model id. Gemini *-image* use generateText+files; Seedream/Grok use generateImage. */
  gatewayModelId: string
  /** Soft estimate GBP per image for spend gate / ledger. */
  estimateGbp: number
}

/**
 * Studio profile id → Gateway model.
 * If Gateway only lists `…-preview` for flash, swap `gatewayModelId` here only.
 */
export const GATEWAY_IMAGE_MODELS: readonly GatewayImageModel[] = [
  {
    profileId: 'gemini-flash-image',
    label: 'Fast pictures',
    description: 'google/gemini-3.1-flash-image — fast',
    gatewayModelId: 'google/gemini-3.1-flash-image',
    estimateGbp: 0.04,
  },
  {
    profileId: 'gemini-pro-image',
    label: 'Better pictures',
    description: 'google/gemini-3-pro-image — higher quality',
    gatewayModelId: 'google/gemini-3-pro-image',
    estimateGbp: 0.12,
  },
  {
    profileId: 'grok-imagine',
    label: 'Grok pictures',
    description: 'spacexai/grok-imagine-image',
    gatewayModelId: 'spacexai/grok-imagine-image',
    estimateGbp: 0.08,
  },
  {
    profileId: 'seedream-lite',
    label: 'Cheap pictures',
    description: 'bytedance/seedream-5.0-lite — cheap draft',
    gatewayModelId: 'bytedance/seedream-5.0-lite',
    estimateGbp: 0.03,
  },
  {
    profileId: 'seedream-pro',
    label: 'Best pictures',
    description: 'bytedance/seedream-5.0-pro — high fidelity',
    gatewayModelId: 'bytedance/seedream-5.0-pro',
    estimateGbp: 0.15,
  },
] as const

export const GATEWAY_IMAGE_PROFILE_IDS = GATEWAY_IMAGE_MODELS.map((m) => m.profileId)

export const isStubImageModelId = (modelId: string): boolean =>
  modelId.startsWith('mock') || modelId.startsWith('placeholder/') || modelId === 'disabled'

/** Dead / renamed Gateway image ids → live ids (ADR-0085). */
export const LEGACY_IMAGE_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'xai/grok-imagine-image': 'spacexai/grok-imagine-image',
}

export const canonicalizeImageModelId = (modelId: string): string =>
  LEGACY_IMAGE_MODEL_ALIASES[modelId] ?? modelId

export const isGatewayImageModelId = (modelId: string): boolean => {
  const id = canonicalizeImageModelId(modelId)
  return (
    GATEWAY_IMAGE_MODELS.some((m) => m.gatewayModelId === id) ||
    id.startsWith('google/') ||
    id.startsWith('spacexai/') ||
    id.startsWith('bytedance/')
  )
}

/** Allowlisted id missing from Gateway with no successor — no spend (ADR-0085). */
export const isFrozenImageModelId = (modelId: string): boolean => {
  if (isStubImageModelId(modelId)) return false
  const id = canonicalizeImageModelId(modelId)
  return id.startsWith('xai/')
}
