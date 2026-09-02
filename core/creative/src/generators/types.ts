import type { BrandPromptContext } from '../brand/prompt-context'

export type AssetRef = {
  kind: 'image' | 'video' | 'audio'
  bytes: Uint8Array
  contentType: string
  probe: Record<string, unknown>
  brandRefsUnsupported?: boolean
}

export type GenerateImageInput = {
  prompt: string
  brand: BrandPromptContext
  referenceAssetIds: string[]
  aspectRatio: string
  modelId: string
}

export type GenerateVideoInput = {
  prompt: string
  brand: BrandPromptContext
  sourceImageAssetId?: string
  /** When present, live i2v sends this still to the video model (ADR-0048 / ADR-0050). */
  sourceImageBytes?: Uint8Array
  /** Extra stills after the first frame (Seedance refs). First still stays sourceImage*. */
  referenceImageAssetIds?: string[]
  /** Mentioned video clips sent as Seedance `[Video n]` refs. */
  referenceVideoAssetIds?: string[]
  referenceImages?: Array<{ bytes: Uint8Array; mediaType: string }>
  durationSeconds: number
  modelId: string
  /** Spend/safety cap from the Model Profile. Live clips longer than this fail QC. */
  maxVideoSeconds?: number
}

export type GenerateSpeechInput = {
  text: string
  brand: BrandPromptContext
  modelId: string
  /** ElevenLabs Instant Voice Clone id when synthesizing a clone profile (ADR-0060). */
  cloneVoiceId?: string
}

export type GenerateMusicInput = {
  prompt: string
  modelId: string
  /** Target length in ms (clamped 3s–600s). */
  durationMs: number
  forceInstrumental?: boolean
  /** Optional brand music.style.json merge input. */
  musicStyle?: {
    tempoBpm?: number
    mood?: string
    genres?: string[]
    avoidVocals?: boolean
    energy?: 'low' | 'medium' | 'high'
    referenceNotes?: string
    negativeStyles?: string[]
  }
}

export type TranscribeInput = {
  audioAssetId: string
  modelId: string
  /** Required for real Gateway STT; stub path can infer from bytes/hints. */
  audioBytes?: Uint8Array
  /** Optional MIME (e.g. audio/mpeg) when known from the asset. */
  mediaType?: string
  /** Optional filename / blob key basename for MIME sniffing when contentType is missing. */
  fileName?: string
}

export type TranscribeResult = {
  text: string
  segments: Array<{ startMs: number; endMs: number; text: string }>
  brandRefsUnsupported?: boolean
}
