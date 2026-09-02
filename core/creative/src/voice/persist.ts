/** Persist Voice Studio rows (ADR-0033 / #214). */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertCloneReady,
  CLONE_CONSENT_REQUIRED_MESSAGE,
  CLONE_SAMPLE_REQUIRED_MESSAGE,
  voiceOperatorError,
  voiceProfileFromRow,
  type VoiceEventKind,
  type VoiceProfile,
  type VoiceProfileKind,
} from './schema'

export const listVoiceProfiles = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<VoiceProfile[]> => {
  const { data, error } = await supabase
    .from('voice_profiles')
    .select('*')
    .eq('product_id', productId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to list voice profiles: ${error.message}`)
  return ((data as Array<Parameters<typeof voiceProfileFromRow>[0]> | null) ?? []).map(
    voiceProfileFromRow,
  )
}

export const getVoiceProfile = async (
  supabase: SupabaseClient,
  input: { productId: string; profileId: string },
): Promise<VoiceProfile> => {
  const { data, error } = await supabase
    .from('voice_profiles')
    .select('*')
    .eq('product_id', input.productId)
    .eq('id', input.profileId)
    .maybeSingle()
  if (error) throw new Error(`Failed to load voice profile: ${error.message}`)
  if (!data) throw new Error('Voice profile not found.')
  return voiceProfileFromRow(data as Parameters<typeof voiceProfileFromRow>[0])
}

export const insertVoiceProfile = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    name: string
    locale?: string
    kind: VoiceProfileKind
    providerVoiceId?: string | null
    sampleBlobKey?: string | null
    consentRecorded: boolean
    consentSource?: string | null
  },
): Promise<VoiceProfile> => {
  const now = new Date().toISOString()
  const consentAt = input.kind === 'clone' && input.consentRecorded ? now : null
  if (input.kind === 'clone' && !input.consentRecorded) {
    throw voiceOperatorError(CLONE_CONSENT_REQUIRED_MESSAGE)
  }
  if (input.kind === 'clone' && !input.sampleBlobKey?.trim()) {
    throw voiceOperatorError(CLONE_SAMPLE_REQUIRED_MESSAGE)
  }
  const row = {
    product_id: input.productId,
    name: input.name.trim(),
    locale: input.locale ?? 'en',
    kind: input.kind,
    provider_voice_id: input.providerVoiceId ?? (input.kind === 'clone' ? 'mock-clone' : null),
    sample_blob_key: input.sampleBlobKey ?? null,
    consent_at: consentAt,
    consent_source: input.consentSource ?? (consentAt ? 'settings-voice' : null),
    status: 'active',
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await supabase.from('voice_profiles').insert(row).select('*').single()
  if (error || !data) {
    throw new Error(`Failed to create voice profile: ${error?.message ?? 'no row'}`)
  }
  const profile = voiceProfileFromRow(data as Parameters<typeof voiceProfileFromRow>[0])
  if (profile.kind === 'clone') assertCloneReady(profile)
  return profile
}

export const archiveVoiceProfile = async (
  supabase: SupabaseClient,
  input: { productId: string; profileId: string },
): Promise<void> => {
  const { error } = await supabase
    .from('voice_profiles')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('product_id', input.productId)
    .eq('id', input.profileId)
  if (error) throw new Error(`Failed to archive voice profile: ${error.message}`)
}

export const insertVoiceEvent = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    projectId?: string | null
    profileId?: string | null
    assetId?: string | null
    kind: VoiceEventKind
    modelId?: string | null
    inputSnapshot?: Record<string, unknown>
  },
): Promise<void> => {
  const { error } = await supabase.from('voice_events').insert({
    product_id: input.productId,
    project_id: input.projectId ?? null,
    profile_id: input.profileId ?? null,
    asset_id: input.assetId ?? null,
    kind: input.kind,
    model_id: input.modelId ?? null,
    input_snapshot: input.inputSnapshot ?? {},
  })
  if (error) throw new Error(`Failed to record voice event: ${error.message}`)
}

export const insertDubJob = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    projectId: string
    generationJobId?: string | null
    profileId?: string | null
    assetId?: string | null
    sourceLocale: string
    targetLocale: string
    status: 'queued' | 'running' | 'ready' | 'failed'
    errorMessage?: string | null
  },
): Promise<{ id: string }> => {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('dub_jobs')
    .insert({
      product_id: input.productId,
      project_id: input.projectId,
      generation_job_id: input.generationJobId ?? null,
      profile_id: input.profileId ?? null,
      asset_id: input.assetId ?? null,
      source_locale: input.sourceLocale,
      target_locale: input.targetLocale,
      status: input.status,
      error_message: input.errorMessage ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`Failed to insert dub job: ${error?.message ?? 'no row'}`)
  }
  return { id: data.id as string }
}

export const listPendingVoiceJobs = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<Array<{ id: string; status: string; role: string }>> => {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('id, status, role')
    .eq('project_id', projectId)
    .in('role', ['voice_clone', 'voice_synth', 'voice_dub', 'voice_lipsync'])
    .in('status', ['queued', 'generating'])
    .order('created_at', { ascending: false })
    .limit(8)
  if (error) throw new Error(`Failed to list Voice Studio jobs: ${error.message}`)
  return (data as Array<{ id: string; status: string; role: string }> | null) ?? []
}
