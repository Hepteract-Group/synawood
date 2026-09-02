import { GATEWAY_REASONER_MODELS } from '../model-profiles/reasoner-models'
import { canonicalizeImageModelId } from '../model-profiles/image-models'
import { WAN3_GBP_PER_SECOND, WAN3_VIDEO_MODEL_ID } from '../model-profiles/video-families/wan3'
import {
  MINIMAX_H3_GBP_PER_SECOND,
  MINIMAX_H3_MAX_GBP_PER_SECOND,
  MINIMAX_H3_MAX_VIDEO_MODEL_ID,
  MINIMAX_H3_VIDEO_MODEL_ID,
} from '../model-profiles/video-families/minimax-h3'
import { canonicalizeVideoModelId, GATEWAY_VIDEO_MODELS } from '../model-profiles/video-models'

/** Approximate GBP price table — living estimates, not invoices. */

export type PriceUnit =
  'image' | 'video_second' | 'speech_second' | 'transcribe_second' | 'music_second'

export const PRICE_TABLE_GBP: Record<string, { unit: PriceUnit; gbpPerUnit: number }> = {
  'mock-image': { unit: 'image', gbpPerUnit: 0 },
  'mock-video': { unit: 'video_second', gbpPerUnit: 0 },
  'mock-speech': { unit: 'speech_second', gbpPerUnit: 0 },
  'mock-transcribe': { unit: 'transcribe_second', gbpPerUnit: 0 },
  'mock-enhance': { unit: 'transcribe_second', gbpPerUnit: 0 },
  'mock-caption': { unit: 'image', gbpPerUnit: 0 },
  'mock-music': { unit: 'music_second', gbpPerUnit: 0 },
  'mock-voice-clone': { unit: 'speech_second', gbpPerUnit: 0 },
  'mock-lipsync': { unit: 'speech_second', gbpPerUnit: 0 },
  'openai/text-embedding-3-small': { unit: 'image', gbpPerUnit: 0.0001 },
  'google/gemini-embedding-2': { unit: 'image', gbpPerUnit: 0.0002 },
  'mock-embed-visual': { unit: 'image', gbpPerUnit: 0 },
  'placeholder/cheap-image': { unit: 'image', gbpPerUnit: 0.02 },
  'placeholder/balanced-image': { unit: 'image', gbpPerUnit: 0.08 },
  'placeholder/hi-image': { unit: 'image', gbpPerUnit: 0.2 },
  'placeholder/cheap-video': { unit: 'video_second', gbpPerUnit: 0.12 },
  'placeholder/balanced-video': { unit: 'video_second', gbpPerUnit: 0.35 },
  'placeholder/hi-video': { unit: 'video_second', gbpPerUnit: 0.9 },
  ...Object.fromEntries(
    GATEWAY_VIDEO_MODELS.map((row) => [
      row.gatewayModelId,
      { unit: 'video_second' as const, gbpPerUnit: row.gbpPerSecond },
    ]),
  ),
  [WAN3_VIDEO_MODEL_ID]: { unit: 'video_second', gbpPerUnit: WAN3_GBP_PER_SECOND },
  [MINIMAX_H3_VIDEO_MODEL_ID]: { unit: 'video_second', gbpPerUnit: MINIMAX_H3_GBP_PER_SECOND },
  [MINIMAX_H3_MAX_VIDEO_MODEL_ID]: {
    unit: 'video_second',
    gbpPerUnit: MINIMAX_H3_MAX_GBP_PER_SECOND,
  },
  'google/gemini-3.1-flash-image': { unit: 'image', gbpPerUnit: 0.04 },
  'google/gemini-3-pro-image': { unit: 'image', gbpPerUnit: 0.12 },
  'spacexai/grok-imagine-image': { unit: 'image', gbpPerUnit: 0.08 },
  'bytedance/seedream-5.0-lite': { unit: 'image', gbpPerUnit: 0.03 },
  'bytedance/seedream-5.0-pro': { unit: 'image', gbpPerUnit: 0.15 },
  'openai/tts-1': { unit: 'speech_second', gbpPerUnit: 0.002 },
  'openai/tts-1-hd': { unit: 'speech_second', gbpPerUnit: 0.004 },
  'elevenlabs/eleven_multilingual_v2': { unit: 'speech_second', gbpPerUnit: 0.006 },
  eleven_multilingual_v2: { unit: 'speech_second', gbpPerUnit: 0.006 },
  'openai/whisper-1': { unit: 'transcribe_second', gbpPerUnit: 0.001 },
  // ElevenLabs Music — rough £/sec living estimate (confirmSpend still applies).
  'elevenlabs/music_v1': { unit: 'music_second', gbpPerUnit: 0.04 },
  'elevenlabs/music_v2': { unit: 'music_second', gbpPerUnit: 0.06 },
  music_v1: { unit: 'music_second', gbpPerUnit: 0.04 },
  music_v2: { unit: 'music_second', gbpPerUnit: 0.06 },
}

export const estimateGbp = (modelId: string, units: number): number => {
  const canonical = canonicalizeImageModelId(canonicalizeVideoModelId(modelId))
  const row = PRICE_TABLE_GBP[canonical] ?? PRICE_TABLE_GBP[modelId]
  if (!row) {
    // Unknown model: fail closed with a conservative estimate so caps still apply.
    return Math.max(0.5, units * 0.25)
  }
  return Number((row.gbpPerUnit * units).toFixed(4))
}

/** Token-based £ estimate for a reasoner turn (attribution / session spend). */
export const estimateReasonerGbp = (
  modelId: string,
  input: { inputTokens: number; outputTokens: number },
): number => {
  if (modelId === 'mock-reasoner') return 0
  const row = GATEWAY_REASONER_MODELS.find((model) => model.gatewayModelId === modelId)
  const inRate = row?.gbpPerMillionInput ?? 2
  const outRate = row?.gbpPerMillionOutput ?? 8
  const gbp =
    (Math.max(0, input.inputTokens) / 1_000_000) * inRate +
    (Math.max(0, input.outputTokens) / 1_000_000) * outRate
  return Number(gbp.toFixed(6))
}
