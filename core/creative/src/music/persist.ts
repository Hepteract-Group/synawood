/** Wave 2E / #192–#193 — persist music_generations rows. */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  musicGenerationFromRow,
  type MusicGeneration,
  type MusicLicenseStatus,
  type MusicLicenseTier,
  type MusicProvider,
} from './schema'

export const insertMusicGeneration = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    projectId: string | null
    generationJobId: string | null
    assetId: string | null
    prompt: string | null
    modelId: string | null
    provider: MusicProvider
    durationMs: number | null
    forceInstrumental: boolean
    licenseStatus: MusicLicenseStatus
    licenseTier: MusicLicenseTier | null
    commercialUseAllowed: boolean
    licenseNotes: string | null
    providerSongId: string | null
    inputSnapshot?: Record<string, unknown>
  },
): Promise<MusicGeneration> => {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('music_generations')
    .insert({
      product_id: input.productId,
      project_id: input.projectId,
      generation_job_id: input.generationJobId,
      asset_id: input.assetId,
      prompt: input.prompt,
      model_id: input.modelId,
      provider: input.provider,
      duration_ms: input.durationMs,
      force_instrumental: input.forceInstrumental,
      license_status: input.licenseStatus,
      license_tier: input.licenseTier,
      commercial_use_allowed: input.commercialUseAllowed,
      license_notes: input.licenseNotes,
      provider_song_id: input.providerSongId,
      input_snapshot: input.inputSnapshot ?? {},
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()
  if (error || !data) {
    throw new Error(`Failed to insert music_generations: ${error?.message ?? 'no row'}`)
  }
  return musicGenerationFromRow(data as Parameters<typeof musicGenerationFromRow>[0])
}

export const listMusicGenerationsForProject = async (
  supabase: SupabaseClient,
  input: { productId: string; projectId: string; limit?: number },
): Promise<MusicGeneration[]> => {
  const limit = Math.max(1, Math.min(input.limit ?? 24, 50))
  const { data, error } = await supabase
    .from('music_generations')
    .select('*')
    .eq('product_id', input.productId)
    .eq('project_id', input.projectId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    throw new Error(`Failed to list music_generations: ${error.message}`)
  }
  return ((data as Array<Parameters<typeof musicGenerationFromRow>[0]> | null) ?? []).map(
    musicGenerationFromRow,
  )
}
