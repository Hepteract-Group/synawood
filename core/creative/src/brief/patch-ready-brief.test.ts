import { describe, expect, it, vi } from 'vitest'
import { loadBriefFixture } from './fixtures/load-fixture'
import { mergeReadyBriefBrandPatch, patchReadyBriefBrandCandidates } from './patch-ready-brief'
import type { ExtractedBrief } from './extracted-brief'

const sample = (): ExtractedBrief => loadBriefFixture('acme-url-brief')

describe('mergeReadyBriefBrandPatch', () => {
  it('updates logoAssetId so Apply uses the Brand Studio correction', () => {
    const brief = sample()
    brief.brandCandidates.logoAssetId = '11111111-1111-4111-8111-111111111111'
    const next = mergeReadyBriefBrandPatch(brief, {
      logoAssetId: '22222222-2222-4222-8222-222222222222',
    })
    expect(next.brandCandidates.logoAssetId).toBe('22222222-2222-4222-8222-222222222222')
    expect(next.brandCandidates.displayName).toBe('Acme')
  })

  it('clears logo when Brand Studio clears it', () => {
    const brief = sample()
    brief.brandCandidates.logoAssetId = '11111111-1111-4111-8111-111111111111'
    const next = mergeReadyBriefBrandPatch(brief, { clearLogo: true })
    expect(next.brandCandidates.logoAssetId).toBeUndefined()
  })
})

describe('patchReadyBriefBrandCandidates', () => {
  it('returns null when no ready brief exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const limit = vi.fn().mockReturnValue({ maybeSingle })
    const order = vi.fn().mockReturnValue({ limit })
    const eqStatus = vi.fn().mockReturnValue({ order })
    const eqProject = vi.fn().mockReturnValue({ eq: eqStatus })
    const select = vi.fn().mockReturnValue({ eq: eqProject })
    const supabase = { from: vi.fn().mockReturnValue({ select }) }

    await expect(
      patchReadyBriefBrandCandidates(supabase as never, 'proj-1', {
        logoAssetId: '22222222-2222-4222-8222-222222222222',
      }),
    ).resolves.toBeNull()
  })

  it('patches ready brief_json in place', async () => {
    const brief = sample()
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'brief-1', brief_json: brief, status: 'ready' },
      error: null,
    })
    const limit = vi.fn().mockReturnValue({ maybeSingle })
    const order = vi.fn().mockReturnValue({ limit })
    const eqStatus = vi.fn().mockReturnValue({ order })
    const eqProject = vi.fn().mockReturnValue({ eq: eqStatus })
    const select = vi.fn().mockReturnValue({ eq: eqProject })

    const updateEqStatus = vi.fn().mockResolvedValue({ error: null })
    const updateEqProject = vi.fn().mockReturnValue({ eq: updateEqStatus })
    const updateEqId = vi.fn().mockReturnValue({ eq: updateEqProject })
    const update = vi.fn().mockReturnValue({ eq: updateEqId })

    const from = vi.fn((table: string) => {
      if (table === 'extracted_briefs') {
        return { select, update }
      }
      return {}
    })
    const supabase = { from }

    const result = await patchReadyBriefBrandCandidates(supabase as never, 'proj-1', {
      primaryColor: '#112233',
    })
    expect(result).toEqual({ briefId: 'brief-1' })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        brief_json: expect.objectContaining({
          brandCandidates: expect.objectContaining({ primaryColor: '#112233' }),
        }),
      }),
    )
  })
})
