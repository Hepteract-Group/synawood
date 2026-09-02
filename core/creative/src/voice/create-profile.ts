/** Create a product voice profile, cloning from a sample when kind=clone (ADR-0060). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isStubSpeechModelId } from '../generators/tts'
import { resolveModelRef } from '../model-profiles'
import { putBlob, type BlobEnv } from '../persistence/blob'
import { probeAudioDurationSeconds } from '../generators/audio-duration'
import {
  createProviderCloneVoice,
  MIN_CLONE_SAMPLE_SECONDS,
  type ElevenLabsAddVoiceClient,
} from './clone'
import { insertVoiceProfile } from './persist'
import {
  CLONE_SAMPLE_REQUIRED_MESSAGE,
  voiceOperatorError,
  type VoiceProfile,
  type VoiceProfileKind,
} from './schema'

export type VoiceSampleUpload = {
  bytes: Uint8Array
  contentType: string
  fileName: string
}

export const createProductVoiceProfile = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  name: string
  locale?: string
  kind: VoiceProfileKind
  consentRecorded: boolean
  sample?: VoiceSampleUpload | null
  modelProfileId: string
  addVoice?: ElevenLabsAddVoiceClient
}): Promise<VoiceProfile> => {
  if (input.kind === 'clone' && !input.sample?.bytes.byteLength) {
    throw voiceOperatorError(CLONE_SAMPLE_REQUIRED_MESSAGE)
  }

  let sampleBlobKey: string | null = null
  let providerVoiceId: string | null = null
  if (input.kind === 'clone' && input.sample) {
    const seconds = await probeAudioDurationSeconds(
      input.sample.bytes,
      input.sample.contentType || 'audio/mpeg',
    )
    if (seconds != null && seconds < MIN_CLONE_SAMPLE_SECONDS) {
      throw voiceOperatorError(
        `Voice sample is too short (${Math.round(seconds)}s). Record at least ${MIN_CLONE_SAMPLE_SECONDS} seconds of you speaking.`,
      )
    }
    const uploaded = await putBlob({
      blobEnv: input.blobEnv,
      productId: input.productId,
      kind: 'uploads',
      parts: ['voice-clone', `${crypto.randomUUID()}-${input.sample.fileName || 'sample.webm'}`],
      data: input.sample.bytes,
      contentType: input.sample.contentType || 'audio/webm',
    })
    sampleBlobKey = uploaded.blobKey
    const cloneModel = resolveModelRef(input.modelProfileId, 'voiceClone').modelId
    providerVoiceId = await createProviderCloneVoice({
      name: input.name,
      fileName: input.sample.fileName || 'voice-sample.webm',
      contentType: input.sample.contentType || 'audio/webm',
      bytes: input.sample.bytes,
      stub: isStubSpeechModelId(cloneModel),
      addVoice: input.addVoice,
    })
  }

  return insertVoiceProfile(input.supabase, {
    productId: input.productId,
    name: input.name,
    locale: input.locale,
    kind: input.kind,
    consentRecorded: input.consentRecorded,
    sampleBlobKey,
    providerVoiceId,
  })
}
