import { describe, expect, it, vi } from 'vitest'
import {
  isStubTranscribeModelId,
  resolveAudioMediaType,
  resolveGatewayTranscribeModelId,
  transcribeMedia,
} from './transcribe'

describe('transcribe', () => {
  it('resolves Gateway whisper model ids', () => {
    expect(resolveGatewayTranscribeModelId('openai/whisper-1')).toBe('openai/whisper-1')
    expect(resolveGatewayTranscribeModelId('whisper-1')).toBe('openai/whisper-1')
    expect(isStubTranscribeModelId('mock-transcribe')).toBe(true)
  })

  it('resolves mediaType from MIME, magic bytes, and extension', () => {
    expect(resolveAudioMediaType({ mediaType: 'audio/mpeg' })).toBe('audio/mpeg')
    expect(resolveAudioMediaType({ mediaType: 'audio/mp3' })).toBe('audio/mpeg')
    expect(resolveAudioMediaType({ mediaType: 'application/octet-stream' })).toBe('audio/mpeg')

    const wav = new Uint8Array(12)
    wav.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])
    expect(resolveAudioMediaType({ bytes: wav })).toBe('audio/wav')

    expect(resolveAudioMediaType({ fileName: 'take.m4a' })).toBe('audio/mp4')
  })

  it('returns stub transcript for mock model ids', async () => {
    const result = await transcribeMedia({
      audioAssetId: '11111111-1111-4111-8111-111111111111',
      modelId: 'mock-transcribe',
      audioBytes: new TextEncoder().encode('SYNAWOOD_STUB_SPEECH\ntext=Hello stub line\n'),
    })
    expect(result.text).toBe('Hello stub line')
    expect(result.segments[0]?.startMs).toBe(0)
  })

  it('calls AI Gateway client with resolved mediaType for openai/whisper-1', async () => {
    const gatewayClient = vi.fn(async () => ({
      text: 'Edit PDFs in your browser',
      segments: [{ startSecond: 0, endSecond: 1.5, text: 'Edit PDFs in your browser' }],
    }))
    const prev = process.env.AI_GATEWAY_API_KEY
    process.env.AI_GATEWAY_API_KEY = 'vck-test'
    try {
      const result = await transcribeMedia(
        {
          audioAssetId: '11111111-1111-4111-8111-111111111111',
          modelId: 'openai/whisper-1',
          audioBytes: new Uint8Array([1, 2, 3, 4]),
          mediaType: 'audio/mpeg',
        },
        { gateway: gatewayClient },
      )
      expect(result.text).toBe('Edit PDFs in your browser')
      expect(result.segments[0]).toEqual({
        startMs: 0,
        endMs: 1500,
        text: 'Edit PDFs in your browser',
      })
      expect(gatewayClient).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'openai/whisper-1',
          mediaType: 'audio/mpeg',
        }),
      )
    } finally {
      if (prev === undefined) delete process.env.AI_GATEWAY_API_KEY
      else process.env.AI_GATEWAY_API_KEY = prev
    }
  })

  it('requires AI_GATEWAY_API_KEY and audio bytes for real models', async () => {
    const prev = process.env.AI_GATEWAY_API_KEY
    delete process.env.AI_GATEWAY_API_KEY
    try {
      await expect(
        transcribeMedia({
          audioAssetId: '11111111-1111-4111-8111-111111111111',
          modelId: 'openai/whisper-1',
          audioBytes: new Uint8Array([1]),
        }),
      ).rejects.toThrow(/AI_GATEWAY_API_KEY/)
    } finally {
      if (prev !== undefined) process.env.AI_GATEWAY_API_KEY = prev
    }

    process.env.AI_GATEWAY_API_KEY = 'vck-test'
    try {
      await expect(
        transcribeMedia({
          audioAssetId: '11111111-1111-4111-8111-111111111111',
          modelId: 'openai/whisper-1',
        }),
      ).rejects.toThrow(/Audio bytes required/)
    } finally {
      if (prev === undefined) delete process.env.AI_GATEWAY_API_KEY
      else process.env.AI_GATEWAY_API_KEY = prev
    }
  })
})
