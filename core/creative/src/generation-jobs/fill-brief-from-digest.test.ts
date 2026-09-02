import { describe, expect, it } from 'vitest'
import { estimateExtractGbp, fillExtractedBriefFromDigest } from './fill-brief-from-digest'
import type { UrlSourceDigest, PdfSourceDigest } from '../extract/types'

describe('fillExtractedBriefFromDigest', () => {
  it('maps a URL digest into an ExtractedBrief', () => {
    const digest: UrlSourceDigest = {
      kind: 'url',
      finalUrl: 'https://example.com/',
      title: 'the private example',
      description: 'Focus PDF reader for founders.',
      textDigest: 'Stop drowning in PDFs. Read smarter with the private example every day.',
      imageCandidates: [],
      colorGuesses: ['#1a5c3a', '#c45c26'],
      fetchedAt: '2026-08-02T12:00:00.000Z',
      bytesRead: 100,
    }
    const brief = fillExtractedBriefFromDigest({ digest, sourceUri: digest.finalUrl })
    expect(brief.source.kind).toBe('url')
    expect(brief.brandCandidates.primaryColor).toBe('#1a5c3a')
    expect(brief.product.name).toBe('the private example')
    expect(brief.brandCandidates.defaultCta).toMatch(/the private example/)
    expect(brief.messaging.ctaCandidates[0]).toMatch(/the private example/)
    expect(brief.messaging.hookCandidates.length).toBeGreaterThan(0)
    expect(brief.confidence.overall).toBeGreaterThan(0)
  })

  it('prefers vivid themeColor over sampled', () => {
    const digest: UrlSourceDigest = {
      kind: 'url',
      finalUrl: 'https://example.com/',
      title: 'Acme',
      textDigest: 'Acme builds widgets for teams everywhere today.',
      imageCandidates: [],
      themeColor: '#1a5c3a',
      colorGuesses: ['#1a5c3a', '#c45c26'],
      fetchedAt: '2026-08-02T12:00:00.000Z',
      bytesRead: 50,
    }
    const brief = fillExtractedBriefFromDigest({
      digest,
      brandAssets: {
        logoAssetId: '22222222-2222-4222-8222-222222222222',
        stillAssetIds: ['33333333-3333-4333-8333-333333333333'],
        sampledPrimaryColor: '#e85a9b',
      },
    })
    expect(brief.brandCandidates.primaryColor).toBe('#1a5c3a')
    expect(brief.brandCandidates.logoAssetId).toBe('22222222-2222-4222-8222-222222222222')
    expect(brief.brandCandidates.stillAssetIds).toEqual(['33333333-3333-4333-8333-333333333333'])
  })

  it('prefers sampled logo color over slate UI theme/CSS chrome', () => {
    const digest: UrlSourceDigest = {
      kind: 'url',
      finalUrl: 'https://example.com/',
      title: 'Okiki Alaso',
      textDigest: 'Okiki Alaso is a brand for modern makers everywhere today.',
      imageCandidates: [],
      themeColor: '#101828',
      colorGuesses: ['#101828', '#364153'],
      fetchedAt: '2026-08-02T12:00:00.000Z',
      bytesRead: 50,
    }
    const brief = fillExtractedBriefFromDigest({
      digest,
      brandAssets: { sampledPrimaryColor: '#e85a9b' },
    })
    expect(brief.brandCandidates.primaryColor).toBe('#e85a9b')
  })

  it('falls back to sampled color when themeColor is absent', () => {
    const digest: UrlSourceDigest = {
      kind: 'url',
      finalUrl: 'https://example.com/',
      title: 'Acme',
      textDigest: 'Acme builds widgets for teams everywhere today.',
      imageCandidates: [],
      colorGuesses: [],
      fetchedAt: '2026-08-02T12:00:00.000Z',
      bytesRead: 50,
    }
    const brief = fillExtractedBriefFromDigest({
      digest,
      brandAssets: { sampledPrimaryColor: '#2244aa' },
    })
    expect(brief.brandCandidates.primaryColor).toBe('#2244aa')
  })

  it('maps a PDF digest into an ExtractedBrief', () => {
    const digest: PdfSourceDigest = {
      kind: 'pdf',
      pageCount: 1,
      pages: [{ page: 1, text: 'Acme Brochure. Fast shipping worldwide.' }],
      imageCandidates: [],
      textDigest: 'Acme Brochure. Fast shipping worldwide. Trusted by teams.',
      fetchedAt: '2026-08-02T12:00:00.000Z',
      bytesRead: 50,
    }
    const brief = fillExtractedBriefFromDigest({
      digest,
      sourceUri: 'local/product/briefs/a.pdf',
    })
    expect(brief.source.kind).toBe('pdf')
    expect(brief.source.blobKey).toBe('local/product/briefs/a.pdf')
    expect(brief.messaging.ctaCandidates.length).toBeGreaterThan(0)
  })
})

describe('estimateExtractGbp', () => {
  it('is zero for No LLM reasoners and positive for paid reasoners', () => {
    expect(estimateExtractGbp('mock-reasoner')).toBe(0)
    expect(estimateExtractGbp('google/gemini-3.1-flash-lite')).toBeGreaterThan(0.04)
    expect(estimateExtractGbp('google/gemini-3.1-flash-lite', { sourceKind: 'pdf' })).toBe(0)
  })
})
