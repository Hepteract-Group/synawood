/** Wave 2E / ADR-0041 / #192 — music generation DTOs + license helpers. */

import { z } from 'zod'

export const musicProviderSchema = z.enum(['elevenlabs', 'mock'])
export type MusicProvider = z.infer<typeof musicProviderSchema>

export const musicLicenseStatusSchema = z.enum(['pending', 'cleared', 'mock', 'blocked', 'unknown'])
export type MusicLicenseStatus = z.infer<typeof musicLicenseStatusSchema>

export const musicLicenseTierSchema = z.enum(['self_serve', 'enterprise', 'mock'])
export type MusicLicenseTier = z.infer<typeof musicLicenseTierSchema>

export const musicGenerationSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().min(1),
    projectId: z.string().uuid().nullable(),
    generationJobId: z.string().uuid().nullable(),
    assetId: z.string().uuid().nullable(),
    prompt: z.string().nullable(),
    modelId: z.string().nullable(),
    provider: musicProviderSchema,
    durationMs: z.number().int().min(3000).max(600_000).nullable(),
    forceInstrumental: z.boolean(),
    licenseStatus: musicLicenseStatusSchema,
    licenseTier: musicLicenseTierSchema.nullable(),
    commercialUseAllowed: z.boolean(),
    licenseNotes: z.string().nullable(),
    providerSongId: z.string().nullable(),
    inputSnapshot: z.record(z.string(), z.unknown()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type MusicGeneration = z.infer<typeof musicGenerationSchema>

export const parseMusicGeneration = (input: unknown): MusicGeneration =>
  musicGenerationSchema.parse(input)

/** Approve / Final may proceed only when license is cleared for commercial use. */
export const isMusicLicensePublishable = (row: {
  licenseStatus: MusicLicenseStatus
  commercialUseAllowed: boolean
}): boolean => row.licenseStatus === 'cleared' && row.commercialUseAllowed === true

/** CI mock beds are never Final-eligible. */
export const isMockMusicLicense = (row: { licenseStatus: MusicLicenseStatus }): boolean =>
  row.licenseStatus === 'mock'

export const toIsoDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${value}`)
  }
  return date.toISOString()
}

export const musicGenerationFromRow = (row: {
  id: string
  product_id: string
  project_id: string | null
  generation_job_id: string | null
  asset_id: string | null
  prompt: string | null
  model_id: string | null
  provider: string
  duration_ms: number | null
  force_instrumental: boolean
  license_status: string
  license_tier: string | null
  commercial_use_allowed: boolean
  license_notes: string | null
  provider_song_id: string | null
  input_snapshot: Record<string, unknown> | null
  created_at: string
  updated_at: string
}): MusicGeneration =>
  parseMusicGeneration({
    id: row.id,
    productId: row.product_id,
    projectId: row.project_id,
    generationJobId: row.generation_job_id,
    assetId: row.asset_id,
    prompt: row.prompt,
    modelId: row.model_id,
    provider: row.provider,
    durationMs: row.duration_ms,
    forceInstrumental: row.force_instrumental,
    licenseStatus: row.license_status,
    licenseTier: row.license_tier,
    commercialUseAllowed: row.commercial_use_allowed,
    licenseNotes: row.license_notes,
    providerSongId: row.provider_song_id,
    inputSnapshot: row.input_snapshot ?? {},
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  })
