/** ElevenLabs Instant Voice Clone + TTS (ADR-0060 / #762). */

import { voiceOperatorError } from './schema'

export const ELEVENLABS_CLONE_TTS_MODEL = 'eleven_multilingual_v2' as const
export const ELEVENLABS_CLONE_MODEL_ID = 'elevenlabs/eleven_multilingual_v2' as const
export const MOCK_CLONE_PROVIDER_VOICE_ID = 'mock-clone' as const
export const MIN_CLONE_SAMPLE_SECONDS = 8

export const isElevenLabsSpeechModelId = (modelId: string): boolean =>
  modelId.toLowerCase().includes('eleven_multilingual') ||
  modelId.toLowerCase().includes('eleven_turbo') ||
  modelId === ELEVENLABS_CLONE_MODEL_ID

export const isMockCloneProviderId = (providerVoiceId: string | null | undefined): boolean =>
  !providerVoiceId?.trim() ||
  providerVoiceId === MOCK_CLONE_PROVIDER_VOICE_ID ||
  providerVoiceId === 'disabled' ||
  providerVoiceId.startsWith('mock-')

export type ElevenLabsAddVoiceClient = (input: {
  apiKey: string
  name: string
  fileName: string
  contentType: string
  bytes: Uint8Array
}) => Promise<{ voiceId: string }>

export type ElevenLabsSpeechClient = (input: {
  apiKey: string
  voiceId: string
  text: string
  modelId: string
}) => Promise<{ bytes: Uint8Array; contentType: string }>

const elevenLabsError = async (response: Response, action: string): Promise<Error> => {
  const text = await response.text().catch(() => '')
  return new Error(
    `ElevenLabs ${action} failed (${response.status}): ${text.slice(0, 400) || response.statusText}`,
  )
}

export const defaultElevenLabsAddVoiceClient: ElevenLabsAddVoiceClient = async (input) => {
  const body = new FormData()
  const copy = new Uint8Array(input.bytes.byteLength)
  copy.set(input.bytes)
  body.append('name', input.name)
  body.append(
    'files',
    new Blob([copy.buffer], { type: input.contentType || 'audio/mpeg' }),
    input.fileName || 'voice-sample.webm',
  )
  body.append('remove_background_noise', 'true')
  const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': input.apiKey },
    body,
  })
  if (!response.ok) throw await elevenLabsError(response, 'voice clone')
  const json = (await response.json().catch(() => null)) as { voice_id?: string } | null
  const voiceId = json?.voice_id?.trim()
  if (!voiceId) throw new Error('ElevenLabs voice clone did not return a voice id.')
  return { voiceId }
}

export const defaultElevenLabsSpeechClient: ElevenLabsSpeechClient = async (input) => {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': input.apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: input.text,
      model_id: input.modelId.includes('turbo') ? 'eleven_turbo_v2_5' : ELEVENLABS_CLONE_TTS_MODEL,
    }),
  })
  if (!response.ok) throw await elevenLabsError(response, 'clone speech')
  const buffer = new Uint8Array(await response.arrayBuffer())
  if (buffer.byteLength < 1) {
    throw new Error('ElevenLabs clone speech returned empty audio.')
  }
  const contentType = response.headers.get('content-type')?.startsWith('audio/')
    ? response.headers.get('content-type')!
    : 'audio/mpeg'
  return { bytes: buffer, contentType }
}

export const requireElevenLabsKey = (env: NodeJS.ProcessEnv = process.env): string => {
  const apiKey = env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) {
    throw voiceOperatorError(
      'ELEVENLABS_API_KEY is required to clone a voice. Set it in dashboard/.env.local (and root .env for workers). Mock clone is only used with MODEL_PROFILE=ci-stub.',
    )
  }
  return apiKey
}

export const createProviderCloneVoice = async (input: {
  name: string
  fileName: string
  contentType: string
  bytes: Uint8Array
  stub: boolean
  addVoice?: ElevenLabsAddVoiceClient
}): Promise<string> => {
  if (input.stub) return MOCK_CLONE_PROVIDER_VOICE_ID
  const apiKey = requireElevenLabsKey()
  const client = input.addVoice ?? defaultElevenLabsAddVoiceClient
  const { voiceId } = await client({
    apiKey,
    name: input.name,
    fileName: input.fileName,
    contentType: input.contentType,
    bytes: input.bytes,
  })
  return voiceId
}

export const speakWithClonedVoice = async (input: {
  text: string
  providerVoiceId: string
  modelId: string
  stub: boolean
  speech?: ElevenLabsSpeechClient
}): Promise<{ bytes: Uint8Array; contentType: string }> => {
  if (input.stub || isMockCloneProviderId(input.providerVoiceId)) {
    const marker = `SYNAWOOD_STUB_CLONE_SPEECH\nvoice=${input.providerVoiceId}\ntext=${input.text.slice(0, 200)}\n`
    return { bytes: new TextEncoder().encode(marker), contentType: 'audio/mpeg' }
  }
  const apiKey = requireElevenLabsKey()
  const client = input.speech ?? defaultElevenLabsSpeechClient
  return client({
    apiKey,
    voiceId: input.providerVoiceId,
    text: input.text,
    modelId: input.modelId,
  })
}
