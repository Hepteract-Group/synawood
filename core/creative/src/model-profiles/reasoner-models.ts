/** Curated Gateway chat/reasoner models for Studio Agent eval (ADR-0007 allowlist). */

export type GatewayReasonerModel = {
  gatewayModelId: string
  label: string
  /** Approximate £ per 1M input tokens — living estimate, not invoice. */
  gbpPerMillionInput: number
  /** Approximate £ per 1M output tokens. */
  gbpPerMillionOutput: number
  /** Screenshot / file parts (extract vision, caption). False for text-only chat. */
  acceptsImageParts: boolean
}

export const GATEWAY_REASONER_MODELS: readonly GatewayReasonerModel[] = [
  {
    gatewayModelId: 'openai/gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    gbpPerMillionInput: 0.32,
    gbpPerMillionOutput: 1.28,
    acceptsImageParts: true,
  },
  {
    gatewayModelId: 'openai/gpt-4.1',
    label: 'GPT-4.1',
    gbpPerMillionInput: 1.6,
    gbpPerMillionOutput: 6.4,
    acceptsImageParts: true,
  },
  {
    gatewayModelId: 'minimax/minimax-m3',
    label: 'MiniMax M3',
    gbpPerMillionInput: 0.6,
    gbpPerMillionOutput: 2.4,
    acceptsImageParts: false,
  },
  {
    gatewayModelId: 'meta/muse-spark-1.1',
    label: 'Muse Spark 1.1',
    gbpPerMillionInput: 1.25,
    gbpPerMillionOutput: 4.25,
    acceptsImageParts: false,
  },
  {
    gatewayModelId: 'alibaba/qwen3.7-plus',
    label: 'Qwen 3.7 Plus',
    gbpPerMillionInput: 0.32,
    gbpPerMillionOutput: 1.28,
    acceptsImageParts: false,
  },
  {
    gatewayModelId: 'alibaba/qwen3.7-max',
    label: 'Qwen 3.7 Max',
    gbpPerMillionInput: 1.25,
    gbpPerMillionOutput: 3.75,
    acceptsImageParts: false,
  },
  {
    gatewayModelId: 'google/gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    gbpPerMillionInput: 0.2,
    gbpPerMillionOutput: 1.2,
    acceptsImageParts: true,
  },
] as const

export const GATEWAY_REASONER_MODEL_IDS = GATEWAY_REASONER_MODELS.map(
  (row) => row.gatewayModelId,
) as readonly string[]

export const isAllowlistedReasonerModelId = (modelId: string): boolean =>
  modelId === 'mock-reasoner' || GATEWAY_REASONER_MODEL_IDS.includes(modelId)

/** Unknown ids are not VLMs — extract then sends screenshot parts to the caption fallback. */
export const reasonerAcceptsImageParts = (modelId: string): boolean =>
  GATEWAY_REASONER_MODELS.some((row) => row.gatewayModelId === modelId && row.acceptsImageParts)
