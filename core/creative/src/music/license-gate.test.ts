import { describe, expect, it, vi } from 'vitest'
import { assertProjectMusicLicensesPublishable } from './license-gate'

describe('assertProjectMusicLicensesPublishable (#196 / #200)', () => {
  it('no-ops when project has no music rows', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    }
    await expect(
      assertProjectMusicLicensesPublishable(
        supabase as never,
        '22222222-2222-4222-8222-222222222222',
        [],
      ),
    ).resolves.toBeUndefined()
  })

  it('throws when a mock license is present on an attached asset', async () => {
    const assetId = '44444444-4444-4444-8444-444444444444'
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      product_id: 'demo',
      project_id: '22222222-2222-4222-8222-222222222222',
      generation_job_id: null,
      asset_id: assetId,
      prompt: 'x',
      model_id: 'mock-music',
      provider: 'mock',
      duration_ms: 10000,
      force_instrumental: true,
      license_status: 'mock',
      license_tier: 'mock',
      commercial_use_allowed: false,
      license_notes: null,
      provider_song_id: null,
      input_snapshot: {},
      created_at: '2026-08-16T12:00:00.000Z',
      updated_at: '2026-08-16T12:00:00.000Z',
    }
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [row], error: null })),
        })),
      })),
    }
    await expect(
      assertProjectMusicLicensesPublishable(supabase as never, row.project_id, [
        { id: assetId, probe: { role: 'music_bed' } },
      ]),
    ).rejects.toThrow(/Approve blocked/)
  })

  it('throws when music_bed asset has no license row (fail closed)', async () => {
    const assetId = '55555555-5555-4555-8555-555555555555'
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    }
    await expect(
      assertProjectMusicLicensesPublishable(
        supabase as never,
        '22222222-2222-4222-8222-222222222222',
        [{ id: assetId, probe: { role: 'music_bed' } }],
      ),
    ).rejects.toThrow(/Approve blocked/)
  })
})
