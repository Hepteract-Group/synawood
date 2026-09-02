import type { GenerateSpeechInput } from './types'
import {
  generateSpeech,
  isStubSpeechModelId,
  mapBrandVoiceToOpenAi,
  resolveGatewaySpeechModelId,
} from './tts'
import { describe, expect, it, vi } from 'vitest'

const brand = {
  productId: 'demo',
  displayName: 'Demo',
  mood: 'calm',
  paletteHex: ['#2563EB'],
  promptTokens: [],
  forbiddenClaims: [],
  doNotes: [],
  dontNotes: [],
  voiceId: 'nova',
  speakingNotes: '',
  defaultCta: 'Try Demo',
  neverFakeProductChrome: true as const,
}

describe('tts', () => {
  it('maps brand voice ids onto OpenAI voices', () => {
    expect(mapBrandVoiceToOpenAi('nova')).toBe('nova')
    expect(mapBrandVoiceToOpenAi('warm-voice')).toBe('nova')
    expect(mapBrandVoiceToOpenAi('mock-demo-en')).toBe('alloy')
    expect(resolveGatewaySpeechModelId('openai/tts-1-hd')).toBe('openai/tts-1-hd')
    expect(resolveGatewaySpeechModelId('openai/tts-1')).toBe('openai/tts-1')
  })

  it('returns stub audio for mock speech model ids', async () => {
    expect(isStubSpeechModelId('mock-speech')).toBe(true)
    const speech = await generateSpeech({
      text: 'Hello Demo',
      brand,
      modelId: 'mock-speech',
    })
    expect(speech.kind).toBe('audio')
    expect(speech.probe.stub).toBe(true)
  })

  it('uses the clone speech client when cloneVoiceId is set', async () => {
    const cloneSpeech = vi.fn(async () => ({
      bytes: new Uint8Array([9, 8, 7, 6]),
      contentType: 'audio/mpeg',
    }))
    const prev = process.env.ELEVENLABS_API_KEY
    process.env.ELEVENLABS_API_KEY = 'el-test'
    try {
      const speech = await generateSpeech(
        {
          text: 'Hello from a cloned voice',
          brand,
          modelId: 'elevenlabs/eleven_multilingual_v2',
          cloneVoiceId: 'voice_abc',
        },
        { cloneSpeech },
      )
      expect(speech.bytes.byteLength).toBe(4)
      expect(speech.probe.cloneVoiceId).toBe('voice_abc')
      expect(cloneSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voiceId: 'voice_abc',
          text: 'Hello from a cloned voice',
        }),
      )
    } finally {
      if (prev === undefined) delete process.env.ELEVENLABS_API_KEY
      else process.env.ELEVENLABS_API_KEY = prev
    }
  })

  it('calls AI Gateway speech client for openai/tts-1', async () => {
    const gatewayClient = vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3, 4]),
      contentType: 'audio/mpeg',
    }))
    const prev = process.env.AI_GATEWAY_API_KEY
    process.env.AI_GATEWAY_API_KEY = 'vck-test'
    try {
      const speech = await generateSpeech(
        { text: 'Edit PDFs in your browser', brand, modelId: 'openai/tts-1' },
        { gateway: gatewayClient },
      )
      expect(speech.bytes.byteLength).toBe(4)
      expect(speech.probe.openAiVoice).toBe('nova')
      expect(speech.probe.gatewayModelId).toBe('openai/tts-1')
      expect(gatewayClient).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'openai/tts-1',
          voice: 'nova',
        }),
      )
    } finally {
      if (prev === undefined) delete process.env.AI_GATEWAY_API_KEY
      else process.env.AI_GATEWAY_API_KEY = prev
    }
  })

  it('requires AI_GATEWAY_API_KEY for real models', async () => {
    const prev = process.env.AI_GATEWAY_API_KEY
    delete process.env.AI_GATEWAY_API_KEY
    try {
      await expect(
        generateSpeech({
          text: 'Hello',
          brand,
          modelId: 'openai/tts-1',
        } satisfies GenerateSpeechInput),
      ).rejects.toThrow(/AI_GATEWAY_API_KEY/)
    } finally {
      if (prev !== undefined) process.env.AI_GATEWAY_API_KEY = prev
    }
  })
})
