import { describe, expect, it } from 'vitest'
import { extractedBriefSchema, lowConfidenceFields, parseExtractedBrief } from './extracted-brief'

describe('extractedBriefSchema', () => {
  const valid = {
    id: '11111111-1111-4111-8111-111111111111',
    source: {
      kind: 'url' as const,
      uri: 'https://example.com',
      fetchedAt: '2026-08-02T10:00:00.000Z',
      title: 'the private example',
    },
    brandCandidates: {
      displayName: 'the private example',
      primaryColor: '#1a5c3a',
      accentColor: '#c45c26',
      defaultCta: 'Try the private example free',
    },
    product: {
      name: 'the private example',
      oneLiner: 'PDF reader for focus',
      benefits: ['Fast open', 'Clean UI'],
      socialProof: ['Loved by founders'],
    },
    messaging: {
      hookCandidates: ['Stop drowning in PDFs', 'Read smarter'],
      ctaCandidates: ['Try the private example free', 'Start now'],
      audienceHints: ['founders', 'knowledge workers'],
      tone: 'direct',
    },
    confidence: { overall: 0.82, fields: { 'brandCandidates.primaryColor': 0.9 } },
  }

  it('parses a complete brief', () => {
    const brief = parseExtractedBrief(valid)
    expect(brief.product.benefits).toEqual(['Fast open', 'Clean UI'])
    expect(brief.messaging.hookCandidates).toHaveLength(2)
    expect(brief.confidence.overall).toBe(0.82)
  })

  it('defaults empty arrays for product and messaging lists', () => {
    const brief = parseExtractedBrief({
      ...valid,
      product: { name: 'X' },
      messaging: {},
    })
    expect(brief.product.benefits).toEqual([])
    expect(brief.product.socialProof).toEqual([])
    expect(brief.messaging.hookCandidates).toEqual([])
    expect(brief.messaging.ctaCandidates).toEqual([])
    expect(brief.messaging.audienceHints).toEqual([])
  })

  it('rejects confidence outside 0–1', () => {
    expect(() =>
      extractedBriefSchema.parse({
        ...valid,
        confidence: { overall: 1.5 },
      }),
    ).toThrow()
  })

  it('rejects unknown source kind', () => {
    expect(() =>
      extractedBriefSchema.parse({
        ...valid,
        source: { ...valid.source, kind: 'html' },
      }),
    ).toThrow()
  })

  it('accepts pdf source with blobKey', () => {
    const brief = parseExtractedBrief({
      ...valid,
      source: {
        kind: 'pdf',
        blobKey: 'local/product/briefs/a.pdf',
        fetchedAt: '2026-08-02T11:00:00.000Z',
      },
    })
    expect(brief.source.kind).toBe('pdf')
    expect(brief.source.blobKey).toBe('local/product/briefs/a.pdf')
  })

  it('lists low-confidence field keys for the wizard', () => {
    const brief = parseExtractedBrief({
      ...valid,
      confidence: {
        overall: 0.6,
        fields: {
          'brandCandidates.primaryColor': 0.9,
          'product.oneLiner': 0.2,
        },
      },
    })
    expect(lowConfidenceFields(brief)).toEqual(['product.oneLiner'])
  })
})
