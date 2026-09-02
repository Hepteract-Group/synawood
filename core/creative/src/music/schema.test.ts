import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  isMockMusicLicense,
  isMusicLicensePublishable,
  musicGenerationFromRow,
  parseMusicGeneration,
} from './schema'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0026_music_generations.sql'),
  'utf8',
)

describe('music generations migration (#192)', () => {
  it('creates music_generations with license fields and service_role RLS', () => {
    expect(migrationSql).toContain('create table public.music_generations')
    expect(migrationSql).toMatch(/license_status/i)
    expect(migrationSql).toMatch(/commercial_use_allowed/i)
    expect(migrationSql).toMatch(/license_tier/i)
    expect(migrationSql).toMatch(/'elevenlabs'/)
    expect(migrationSql).toMatch(/'mock'/)
    expect(migrationSql).toMatch(/alter table public\.music_generations enable row level security/i)
    expect(migrationSql).toMatch(
      /grant select, insert, update, delete on public\.music_generations to service_role/i,
    )
    expect(migrationSql).not.toMatch(
      /grant\s+[^;]*on public\.music_generations to (authenticated|anon)/i,
    )
  })

  it('extends generation_jobs role check to include music', () => {
    expect(migrationSql).toMatch(/generation_jobs_role_check/i)
    expect(migrationSql).toMatch(/'music'/)
    expect(migrationSql).toMatch(/'index'/)
  })
})

describe('music generation schema (#192)', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    productId: 'demo',
    projectId: '22222222-2222-4222-8222-222222222222',
    generationJobId: '33333333-3333-4333-8333-333333333333',
    assetId: '44444444-4444-4444-8444-444444444444',
    prompt: 'lo-fi instrumental bed',
    modelId: 'music_v1',
    provider: 'elevenlabs' as const,
    durationMs: 30_000,
    forceInstrumental: true,
    licenseStatus: 'cleared' as const,
    licenseTier: 'self_serve' as const,
    commercialUseAllowed: true,
    licenseNotes: null,
    providerSongId: 'song_abc',
    inputSnapshot: { force_instrumental: true },
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
  }

  it('parses a cleared ElevenLabs row', () => {
    expect(parseMusicGeneration(base).provider).toBe('elevenlabs')
  })

  it('maps DB rows including +00:00 timestamps', () => {
    const row = musicGenerationFromRow({
      id: base.id,
      product_id: 'demo',
      project_id: base.projectId,
      generation_job_id: base.generationJobId,
      asset_id: base.assetId,
      prompt: base.prompt,
      model_id: base.modelId,
      provider: 'elevenlabs',
      duration_ms: 30_000,
      force_instrumental: true,
      license_status: 'cleared',
      license_tier: 'self_serve',
      commercial_use_allowed: true,
      license_notes: null,
      provider_song_id: 'song_abc',
      input_snapshot: {},
      created_at: '2026-08-16T12:00:00.000+00:00',
      updated_at: '2026-08-16T12:00:00.000+00:00',
    })
    expect(row.createdAt).toBe('2026-08-16T12:00:00.000Z')
    expect(row.commercialUseAllowed).toBe(true)
  })

  it('publishable only when cleared + commercial_use_allowed', () => {
    expect(isMusicLicensePublishable(base)).toBe(true)
    expect(
      isMusicLicensePublishable({ licenseStatus: 'cleared', commercialUseAllowed: false }),
    ).toBe(false)
    expect(isMusicLicensePublishable({ licenseStatus: 'mock', commercialUseAllowed: true })).toBe(
      false,
    )
    expect(
      isMusicLicensePublishable({ licenseStatus: 'pending', commercialUseAllowed: true }),
    ).toBe(false)
  })

  it('treats mock license as non-Final', () => {
    expect(isMockMusicLicense({ licenseStatus: 'mock' })).toBe(true)
    expect(isMockMusicLicense({ licenseStatus: 'cleared' })).toBe(false)
  })

  it('rejects invalid duration bounds', () => {
    expect(() => parseMusicGeneration({ ...base, durationMs: 1000 })).toThrow()
  })
})
