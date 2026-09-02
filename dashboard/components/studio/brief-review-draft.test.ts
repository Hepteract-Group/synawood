import { describe, expect, it } from 'vitest'
import {
  adoptProjectLogoIfCorrected,
  keepLocalBriefDraft,
  sameExtractJob,
} from './brief-review-draft'
import type { ExtractedBrief } from '@synawood/creative/brief/extracted-brief'

const sample = (pricingNotes?: string): ExtractedBrief => ({
  id: '11111111-1111-1111-1111-111111111111',
  source: {
    kind: 'url',
    uri: 'https://example.com',
    fetchedAt: '2026-08-01T00:00:00.000Z',
  },
  brandCandidates: { stillAssetIds: [] },
  product: {
    benefits: [],
    socialProof: [],
    ...(pricingNotes !== undefined ? { pricingNotes } : {}),
  },
  messaging: { hookCandidates: [], ctaCandidates: [], audienceHints: [] },
  confidence: { overall: 0.7 },
})

describe('keepLocalBriefDraft', () => {
  it('uses server brief when there is no local draft', () => {
    const server = sample()
    expect(keepLocalBriefDraft(null, server)).toBe(server)
  })

  it('keeps local edits when re-hydrating (does not clear typed pricing notes)', () => {
    const local = sample('From £29/mo')
    const server = sample()
    expect(keepLocalBriefDraft(local, server)).toBe(local)
    expect(keepLocalBriefDraft(local, server).product.pricingNotes).toBe('From £29/mo')
  })
})

describe('adoptProjectLogoIfCorrected', () => {
  it('prefers the project logo when Brand Studio already replaced it', () => {
    const brief = sample()
    brief.brandCandidates.logoAssetId = '11111111-1111-4111-8111-111111111111'
    const next = adoptProjectLogoIfCorrected(brief, '22222222-2222-4222-8222-222222222222')
    expect(next.brandCandidates.logoAssetId).toBe('22222222-2222-4222-8222-222222222222')
  })
})

describe('sameExtractJob', () => {
  it('treats identical id/status as unchanged', () => {
    expect(
      sameExtractJob(
        { id: 'a', status: 'ready', errorMessage: null },
        { id: 'a', status: 'ready' },
      ),
    ).toBe(true)
  })

  it('detects status changes', () => {
    expect(sameExtractJob({ id: 'a', status: 'generating' }, { id: 'a', status: 'ready' })).toBe(
      false,
    )
  })
})
