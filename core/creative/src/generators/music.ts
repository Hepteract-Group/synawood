/** Wave 2E / #193 — ElevenLabs Music live adapter; mock only for ci-stub. */

import type { AssetRef, GenerateMusicInput } from '../generators/types'
import { assertGeneratedAssetQc } from '../generators/qc'
import { durationFramesFromSeconds, probeAudioDurationSeconds } from '../generators/audio-duration'
import type { MusicLicenseStatus, MusicLicenseTier, MusicProvider } from '../music/schema'
import { mergeMusicPrompt, type MusicStyle } from '../music/style'

export const ELEVENLABS_MUSIC_MODEL_V1 = 'music_v1' as const
export const ELEVENLABS_MUSIC_MODEL_V2 = 'music_v2' as const
export const MOCK_MUSIC_MODEL_ID = 'mock-music' as const

export const isStubMusicModelId = (modelId: string): boolean =>
  modelId.startsWith('mock') || modelId === 'disabled'

export const resolveElevenLabsMusicModelId = (modelId: string): 'music_v1' | 'music_v2' => {
  const bare = modelId.replace(/^elevenlabs\//, '').toLowerCase()
  if (bare.includes('v2') || bare === 'music_v2') return ELEVENLABS_MUSIC_MODEL_V2
  return ELEVENLABS_MUSIC_MODEL_V1
}

export type MusicLicenseMeta = {
  provider: MusicProvider
  licenseStatus: MusicLicenseStatus
  licenseTier: MusicLicenseTier | null
  commercialUseAllowed: boolean
  licenseNotes: string | null
  providerSongId: string | null
}

export type GenerateMusicResult = {
  asset: AssetRef
  license: MusicLicenseMeta
  promptUsed: string
  durationMs: number
}

export type ElevenLabsMusicClient = (input: {
  apiKey: string
  prompt: string
  musicLengthMs: number
  forceInstrumental: boolean
  modelId: 'music_v1' | 'music_v2'
}) => Promise<{ bytes: Uint8Array; contentType: string; songId: string | null }>

const defaultElevenLabsMusicClient: ElevenLabsMusicClient = async (input) => {
  const response = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: {
      'xi-api-key': input.apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      prompt: input.prompt,
      music_length_ms: input.musicLengthMs,
      force_instrumental: input.forceInstrumental,
      model_id: input.modelId,
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `ElevenLabs Music API failed (${response.status}): ${text.slice(0, 400) || response.statusText}`,
    )
  }
  const buffer = new Uint8Array(await response.arrayBuffer())
  if (buffer.byteLength < 1) {
    throw new Error('ElevenLabs Music API returned empty audio')
  }
  const contentType = response.headers.get('content-type')?.startsWith('audio/')
    ? response.headers.get('content-type')!
    : 'audio/mpeg'
  const songId =
    response.headers.get('song-id') ??
    response.headers.get('x-song-id') ??
    response.headers.get('elevenlabs-song-id')
  return { bytes: buffer, contentType, songId }
}

const stubMusic = (
  input: GenerateMusicInput,
  promptUsed: string,
  durationMs: number,
): GenerateMusicResult => {
  const seconds = Math.max(3, Math.round(durationMs / 1000))
  const marker = `SYNAWOOD_STUB_MUSIC\nmodel=${input.modelId}\nprompt=${promptUsed.slice(0, 200)}\n`
  const asset: AssetRef = {
    kind: 'audio',
    bytes: new TextEncoder().encode(marker),
    contentType: 'audio/mpeg',
    probe: {
      durationSeconds: seconds,
      durationFrames: durationFramesFromSeconds(seconds),
      modelId: input.modelId,
      prompt: promptUsed,
      stub: true,
      role: 'music_bed',
    },
  }
  assertGeneratedAssetQc(asset)
  return {
    asset,
    license: {
      provider: 'mock',
      licenseStatus: 'mock',
      licenseTier: 'mock',
      commercialUseAllowed: false,
      licenseNotes: 'CI stub — not publishable (ADR-0041)',
      providerSongId: null,
    },
    promptUsed,
    durationMs,
  }
}

export const clampMusicDurationMs = (ms: number): number =>
  Math.max(3000, Math.min(Math.round(ms), 600_000))

export const generateMusic = async (
  input: GenerateMusicInput,
  deps?: { elevenLabs?: ElevenLabsMusicClient },
): Promise<GenerateMusicResult> => {
  const durationMs = clampMusicDurationMs(input.durationMs)
  const forceInstrumental = input.forceInstrumental !== false
  const style: MusicStyle = input.musicStyle ?? {}
  const promptUsed = mergeMusicPrompt({ userPrompt: input.prompt, style })

  if (isStubMusicModelId(input.modelId)) {
    return stubMusic(input, promptUsed, durationMs)
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY is required for live music generation. Set it in dashboard/.env.local (and root .env for workers). Mock beds are only used with MODEL_PROFILE=ci-stub — Studio will not silently substitute a mock.',
    )
  }

  const modelId = resolveElevenLabsMusicModelId(input.modelId)
  const client = deps?.elevenLabs ?? defaultElevenLabsMusicClient
  const out = await client({
    apiKey,
    prompt: promptUsed,
    musicLengthMs: durationMs,
    forceInstrumental,
    modelId,
  })

  const measured = await probeAudioDurationSeconds(out.bytes, out.contentType)
  const seconds = measured ?? durationMs / 1000
  const asset: AssetRef = {
    kind: 'audio',
    bytes: out.bytes,
    contentType: out.contentType,
    probe: {
      durationSeconds: seconds,
      durationFrames: durationFramesFromSeconds(seconds),
      modelId: input.modelId,
      elevenLabsModelId: modelId,
      prompt: promptUsed,
      forceInstrumental,
      role: 'music_bed',
      durationSource: measured != null ? 'media-parser' : 'request-ms',
      providerSongId: out.songId,
    },
  }
  assertGeneratedAssetQc(asset)

  return {
    asset,
    license: {
      provider: 'elevenlabs',
      licenseStatus: 'cleared',
      licenseTier: 'self_serve',
      commercialUseAllowed: true,
      licenseNotes:
        'ElevenLabs Music self-serve commercial use for digital/ads; film/TV/radio may need Enterprise — see Music Terms.',
      providerSongId: out.songId,
    },
    promptUsed,
    durationMs,
  }
}
