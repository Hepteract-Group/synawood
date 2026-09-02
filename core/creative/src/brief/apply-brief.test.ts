import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../project'
import { applyBriefMinimal, applyBriefToProject } from './apply-brief'
import type { ExtractedBrief } from './extracted-brief'

const sampleBrief = (): ExtractedBrief => ({
  id: '33333333-3333-4333-8333-333333333333',
  source: {
    kind: 'url',
    uri: 'https://example.com/',
    title: 'the private example',
    fetchedAt: '2026-08-02T12:00:00.000Z',
  },
  brandCandidates: {
    displayName: 'the private example',
    primaryColor: '#1a5c3a',
    accentColor: '#c45c26',
    defaultCta: 'Try the private example',
    stillAssetIds: [],
  },
  product: {
    name: 'the private example',
    oneLiner: 'Focus PDF reader for founders.',
    benefits: ['Private files', 'One workspace'],
    socialProof: [],
  },
  messaging: {
    hookCandidates: ['Stop drowning in PDFs', 'Read smarter every day'],
    ctaCandidates: ['Try the private example', 'Get started'],
    audienceHints: [],
    tone: 'direct',
  },
  confidence: { overall: 0.6 },
})

describe('applyBriefMinimal', () => {
  it('seeds brand, mirrors brief, and sets Path C overlays', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const result = applyBriefMinimal({ project, brief: sampleBrief() })
    expect(result.modeUsed).toBe('minimal')
    expect(result.project.brand?.displayName).toBe('the private example')
    expect(result.project.brand?.primaryColor).toBe('#1a5c3a')
    expect(result.project.brand?.defaultCta).toBe('Try the private example')
    expect(result.project.brief?.id).toBe(sampleBrief().id)
    expect(result.project.overlays.find((o) => o.kind === 'hook_title')?.text).toBe(
      'Stop drowning in PDFs',
    )
    expect(result.project.overlays.find((o) => o.kind === 'end_card')?.text).toBe('Try the private example')
  })

  it('falls back to one-liner when hooks are empty or only echo the brand name', () => {
    const brief = sampleBrief()
    brief.messaging.hookCandidates = []
    brief.product.oneLiner = 'Fallback one-liner for founders'
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const result = applyBriefMinimal({ project, brief })
    expect(result.hookText).toBe('Fallback one-liner for founders')
  })

  it('uses product name when brand displayName is missing', () => {
    const brief = sampleBrief()
    delete brief.brandCandidates.displayName
    brief.product.name = 'Product Name Only'
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const result = applyBriefMinimal({ project, brief })
    expect(result.project.brand?.displayName).toBe('Product Name Only')
  })
})

describe('applyBriefToProject', () => {
  it('falls back from director to minimal with a warning', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const result = applyBriefToProject({
      project,
      brief: sampleBrief(),
      firstCutMode: 'director',
    })
    expect(result.modeUsed).toBe('minimal')
    expect(result.warning).toMatch(/#139/)
    expect(result.project.brand?.displayName).toBe('the private example')
  })

  it('defaults to minimal when firstCutMode is omitted', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const result = applyBriefToProject({ project, brief: sampleBrief() })
    expect(result.modeUsed).toBe('minimal')
    expect(result.warning).toBeUndefined()
  })
})
