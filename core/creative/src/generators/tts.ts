import { generateSpeech as aiGenerateSpeech } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import type { AssetRef, GenerateSpeechInput } from './types'
import { assertGeneratedAssetQc } from './qc'
import { durationFramesFromSeconds, probeAudioDurationSeconds } from './audio-duration'
import {
  isElevenLabsSpeechModelId,
  isMockCloneProviderId,
  speakWithClonedVoice,
  type ElevenLabsSpeechClient,
} from '../voice/clone'
import { voiceOperatorError } from '../voice/schema'

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const
type OpenAiVoice = (typeof OPENAI_VOICES)[number]

export const isStubSpeechModelId = (modelId: string): boolean =>
  modelId.startsWith('mock') || modelId === 'disabled'

/** Map Brand kit / free-form voice ids onto OpenAI TTS voices (Gateway openai/tts-*). */
export const mapBrandVoiceToOpenAi = (voiceId: string): OpenAiVoice => {
  const trimmed = voiceId.trim().toLowerCase()
  if ((OPENAI_VOICES as readonly string[]).includes(trimmed)) {
    return trimmed as OpenAiVoice
  }
  if (/nova|warm|bright|female/.test(trimmed)) return 'nova'
  if (/onyx|deep|male|founder|narrat/.test(trimmed)) return 'onyx'
  if (/echo|calm|soft/.test(trimmed)) return 'echo'
  if (/fable|story|british|en-gb|uk/.test(trimmed)) return 'fable'
  if (/shimmer|light|upbeat/.test(trimmed)) return 'shimmer'
  return 'alloy'
}

/** Normalize profile speech ids onto Gateway speech model slugs. */
export const resolveGatewaySpeechModelId = (modelId: string): string => {
  const bare = modelId.replace(/^openai\//, '').toLowerCase()
  if (bare.includes('hd')) return 'openai/tts-1-hd'
  if (bare.includes('tts') || modelId.startsWith('openai/')) return 'openai/tts-1'
  return modelId
}

/** @deprecated Prefer resolveGatewaySpeechModelId */
export const openAiTtsModelName = (modelId: string): 'tts-1' | 'tts-1-hd' => {
  return resolveGatewaySpeechModelId(modelId).endsWith('hd') ? 'tts-1-hd' : 'tts-1'
}

export type GatewaySpeechClient = (input: {
  modelId: string
  voice: OpenAiVoice
  text: string
}) => Promise<{ bytes: Uint8Array; contentType: string }>

const defaultGatewaySpeechClient: GatewaySpeechClient = async ({ modelId, voice, text }) => {
  const result = await aiGenerateSpeech({
    model: gateway.speechModel(modelId),
    text,
    voice,
    outputFormat: 'mp3',
  })
  const bytes = result.audio.uint8Array
  if (bytes.byteLength < 1) {
    throw new Error('AI Gateway TTS returned empty audio')
  }
  const contentType = result.audio.mediaType?.startsWith('audio/')
    ? result.audio.mediaType
    : 'audio/mpeg'
  return { bytes, contentType }
}

const stubSpeech = (input: GenerateSpeechInput): AssetRef => {
  const seconds = Math.max(1, Math.ceil(input.text.split(/\s+/).length / 2.5))
  const marker = `SYNAWOOD_STUB_SPEECH\nvoice=${input.brand.voiceId}\nmodel=${input.modelId}\ntext=${input.text.slice(0, 200)}\n`
  return {
    kind: 'audio',
    bytes: new TextEncoder().encode(marker),
    contentType: 'audio/mpeg',
    probe: {
      durationSeconds: seconds,
      durationFrames: seconds * 30,
      modelId: input.modelId,
      voiceId: input.brand.voiceId,
      text: input.text,
      stub: true,
    },
  }
}

export const generateSpeech = async (
  input: GenerateSpeechInput,
  deps?: { gateway?: GatewaySpeechClient; cloneSpeech?: ElevenLabsSpeechClient },
): Promise<AssetRef> => {
  if (isStubSpeechModelId(input.modelId)) {
    const stub = stubSpeech(input)
    assertGeneratedAssetQc(stub)
    return stub
  }

  if (input.cloneVoiceId && !isMockCloneProviderId(input.cloneVoiceId)) {
    const spoken = await speakWithClonedVoice({
      text: input.text,
      providerVoiceId: input.cloneVoiceId,
      modelId: input.modelId,
      stub: false,
      speech: deps?.cloneSpeech,
    })
    const wordEstimate = Math.max(1, Math.ceil(input.text.split(/\s+/).length / 2.5))
    const measured = await probeAudioDurationSeconds(spoken.bytes, spoken.contentType)
    const seconds = measured ?? wordEstimate
    const asset: AssetRef = {
      kind: 'audio',
      bytes: spoken.bytes,
      contentType: spoken.contentType,
      probe: {
        durationSeconds: seconds,
        durationFrames: durationFramesFromSeconds(seconds),
        modelId: input.modelId,
        voiceId: input.brand.voiceId,
        cloneVoiceId: input.cloneVoiceId,
        text: input.text,
        durationSource: measured != null ? 'media-parser' : 'word-estimate',
      },
    }
    assertGeneratedAssetQc(asset)
    return asset
  }

  if (isElevenLabsSpeechModelId(input.modelId)) {
    throw voiceOperatorError(
      'Clone this voice first. Record or upload a sample in Settings → Voice, then pick that profile in Voice Studio.',
    )
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is required for TTS. Set it in dashboard/.env.local (and Vercel). Speech runs via Vercel AI Gateway (openai/tts-1), not a separate OpenAI key.',
    )
  }

  const voice = mapBrandVoiceToOpenAi(input.brand.voiceId)
  const modelId = resolveGatewaySpeechModelId(input.modelId)
  const client = deps?.gateway ?? defaultGatewaySpeechClient
  const out = await client({ modelId, voice, text: input.text })

  const wordEstimate = Math.max(1, Math.ceil(input.text.split(/\s+/).length / 2.5))
  const measured = await probeAudioDurationSeconds(out.bytes, out.contentType)
  const seconds = measured ?? wordEstimate
  const asset: AssetRef = {
    kind: 'audio',
    bytes: out.bytes,
    contentType: out.contentType,
    probe: {
      durationSeconds: seconds,
      durationFrames: durationFramesFromSeconds(seconds),
      modelId: input.modelId,
      gatewayModelId: modelId,
      voiceId: input.brand.voiceId,
      openAiVoice: voice,
      text: input.text,
      durationSource: measured != null ? 'media-parser' : 'word-estimate',
    },
  }
  assertGeneratedAssetQc(asset)
  return asset
}
