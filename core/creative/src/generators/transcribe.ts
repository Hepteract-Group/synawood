import { gateway } from '@ai-sdk/gateway'
import type { TranscribeInput, TranscribeResult } from './types'

export const isStubTranscribeModelId = (modelId: string): boolean =>
  modelId.startsWith('mock') || modelId === 'disabled'

/** Normalize profile transcribe ids onto Gateway transcription slugs. */
export const resolveGatewayTranscribeModelId = (modelId: string): string => {
  const lower = modelId.trim().toLowerCase()
  if (lower.includes('gpt-4o-mini-transcribe')) return 'openai/gpt-4o-mini-transcribe'
  if (lower.includes('gpt-4o-transcribe')) return 'openai/gpt-4o-transcribe'
  if (lower.includes('whisper') || lower.startsWith('openai/')) return 'openai/whisper-1'
  return modelId
}

/**
 * Gateway STT requires a concrete mediaType string. Prefer declared MIME, then
 * magic-bytes sniff, then filename extension. Never send application/octet-stream.
 */
export const resolveAudioMediaType = (input: {
  mediaType?: string
  fileName?: string
  bytes?: Uint8Array
}): string => {
  const declared = input.mediaType?.trim().toLowerCase()
  if (
    declared &&
    declared !== 'application/octet-stream' &&
    (declared.startsWith('audio/') ||
      declared === 'video/mp4' ||
      declared === 'video/webm' ||
      declared === 'video/mpeg')
  ) {
    if (declared === 'audio/mp3' || declared === 'audio/mpg') return 'audio/mpeg'
    if (declared === 'audio/x-wav' || declared === 'audio/wave') return 'audio/wav'
    if (declared === 'audio/x-m4a' || declared === 'audio/m4a') return 'audio/mp4'
    return declared
  }

  const bytes = input.bytes
  if (bytes && bytes.byteLength >= 12) {
    const head = String.fromCharCode(...bytes.slice(0, 4))
    if (head === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WAVE') {
      return 'audio/wav'
    }
    if (head === 'fLaC') return 'audio/flac'
    if (head === 'OggS') return 'audio/ogg'
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg'
    if (head === 'ID3') return 'audio/mpeg'
    // ISO BMFF (m4a/mp4): ....ftyp
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return 'audio/mp4'
    }
    // EBML (webm/mkv)
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return 'audio/webm'
    }
  }

  const name = (input.fileName ?? '').toLowerCase()
  if (/\.wav$/i.test(name)) return 'audio/wav'
  if (/\.(m4a|mp4|aac)$/i.test(name)) return 'audio/mp4'
  if (/\.(ogg|oga)$/i.test(name)) return 'audio/ogg'
  if (/\.flac$/i.test(name)) return 'audio/flac'
  if (/\.webm$/i.test(name)) return 'audio/webm'
  if (/\.(mp3|mpeg|mpga)$/i.test(name)) return 'audio/mpeg'

  return 'audio/mpeg'
}

export type GatewayTranscribeClient = (input: {
  modelId: string
  audio: Uint8Array
  mediaType?: string
}) => Promise<{
  text: string
  segments: Array<{ startSecond: number; endSecond: number; text: string }>
}>

const bytesToBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

const formatGatewayTranscribeError = (error: unknown, mediaType: string): Error => {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()
  if (lower.includes('invalid file format') || lower.includes('unsupported')) {
    return new Error(
      `Transcription failed: unsupported audio format (sent as ${mediaType}). Use mp3, wav, m4a, or ogg.`,
    )
  }
  if (lower.includes('expected string') && lower.includes('mediatype')) {
    return new Error(
      'Transcription failed: AI Gateway requires a mediaType. Re-upload the file or regenerate the voiceover.',
    )
  }
  if (lower.includes('invalid error response') || lower.includes('gateway request failed')) {
    return new Error(
      `Transcription failed via AI Gateway (${mediaType}). Check AI_GATEWAY_API_KEY and that the file is a supported audio format (mp3/wav/m4a).`,
    )
  }
  return error instanceof Error ? error : new Error(message)
}

/**
 * Call Gateway transcription with an explicit mediaType — required by
 * /v4/ai/transcription-model (Uint8Array-only AI SDK path can omit it and 400).
 */
const defaultGatewayTranscribeClient: GatewayTranscribeClient = async ({
  modelId,
  audio,
  mediaType,
}) => {
  const resolvedType = resolveAudioMediaType({ mediaType, bytes: audio })
  try {
    const model = gateway.transcriptionModel(modelId)
    const result = await model.doGenerate({
      audio: bytesToBase64(audio),
      mediaType: resolvedType,
    })
    const segments = (result.segments ?? []).map((segment) => ({
      startSecond: segment.startSecond,
      endSecond: segment.endSecond,
      text: segment.text,
    }))
    return { text: result.text, segments }
  } catch (error) {
    throw formatGatewayTranscribeError(error, resolvedType)
  }
}

const stubTranscribe = (input: TranscribeInput): TranscribeResult => {
  const hint =
    input.audioBytes && input.audioBytes.byteLength > 0
      ? new TextDecoder().decode(input.audioBytes).slice(0, 200)
      : `transcript for asset ${input.audioAssetId}`
  const text = hint.includes('text=')
    ? (hint.split('text=')[1]?.split('\n')[0] ?? 'Edit PDFs without Adobe')
    : 'Edit PDFs without Adobe'
  return {
    text,
    segments: [{ startMs: 0, endMs: 3000, text }],
  }
}

const toMsSegments = (
  segments: Array<{ startSecond: number; endSecond: number; text: string }>,
): TranscribeResult['segments'] =>
  segments.map((segment) => ({
    startMs: Math.round(segment.startSecond * 1000),
    endMs: Math.round(segment.endSecond * 1000),
    text: segment.text.trim(),
  }))

export const transcribeMedia = async (
  input: TranscribeInput,
  deps?: { gateway?: GatewayTranscribeClient },
): Promise<TranscribeResult> => {
  if (isStubTranscribeModelId(input.modelId)) {
    return stubTranscribe(input)
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is required for transcription. Set it in dashboard/.env.local (and Vercel). STT runs via Vercel AI Gateway (openai/whisper-1).',
    )
  }

  if (!input.audioBytes || input.audioBytes.byteLength < 1) {
    throw new Error(
      `Audio bytes required to transcribe asset ${input.audioAssetId}. Download the blob before calling transcribeMedia.`,
    )
  }

  const modelId = resolveGatewayTranscribeModelId(input.modelId)
  const mediaType = resolveAudioMediaType({
    mediaType: input.mediaType,
    fileName: input.fileName,
    bytes: input.audioBytes,
  })
  const client = deps?.gateway ?? defaultGatewayTranscribeClient
  const out = await client({
    modelId,
    audio: input.audioBytes,
    mediaType,
  })

  const text = out.text.trim()
  if (!text) {
    throw new Error('AI Gateway transcription returned empty text')
  }

  const segments = toMsSegments(out.segments)
  return {
    text,
    segments:
      segments.length > 0
        ? segments
        : [{ startMs: 0, endMs: Math.max(1000, text.split(/\s+/).length * 400), text }],
  }
}
