import { describe, expect, it } from 'vitest'
import { parseExtractedBrief } from '../brief/extracted-brief'
import { attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { materializeVariantProject } from './materialize'
import {
  VARIANT_RENDER_GBP,
  buildVariantPlan,
  dimensionsForAspect,
  estimateVariantMatrixGbp,
  makeVariantSpec,
} from './plan'
import { resolveVariantCopy } from './resolve'

const sampleBrief = () =>
  parseExtractedBrief({
    id: '11111111-1111-4111-8111-111111111111',
    source: {
      kind: 'url',
      uri: 'https://example.com/',
      fetchedAt: '2026-08-02T12:00:00.000Z',
    },
    brandCandidates: {
      displayName: 'Acme',
      stillAssetIds: [],
      primaryColor: '#1a5c3a',
      defaultCta: 'Learn more',
    },
    product: { name: 'Acme', oneLiner: 'Widgets', benefits: [], socialProof: [] },
    messaging: {
      hookCandidates: ['Stop shipping blind', 'Clarity for every launch'],
      ctaCandidates: ['Try Acme', 'Book a demo'],
      audienceHints: [],
      tone: 'direct',
    },
    confidence: { overall: 0.8 },
  })

describe('estimateVariantMatrixGbp', () => {
  it('prices Remotion export and zeros create-only', () => {
    expect(estimateVariantMatrixGbp({ variantCount: 4, includeRenders: true })).toBe(0.12)
    expect(estimateVariantMatrixGbp({ variantCount: 4, includeRenders: false })).toBe(0)
  })
})

describe('buildVariantPlan', () => {
  it('splits create vs export estimates and warns in founder language', () => {
    const plan = buildVariantPlan({
      platforms: ['tiktok', 'ig_reels', 'yt_shorts'],
      hookIndexes: [0, 1],
      ctaIndexes: [0, 1],
      includeRenders: true,
    })
    expect(plan.requestedCount).toBe(12)
    expect(plan.items).toHaveLength(12)
    expect(plan.truncated).toBe(false)
    expect(plan.createEstimatedGbp).toBe(0)
    expect(plan.exportEstimatedGbp).toBe(estimateVariantMatrixGbp({ variantCount: 12 }))
    expect(plan.estimatedGbp).toBe(plan.exportEstimatedGbp)
    expect(plan.warnings.some((w) => w.includes('Creating versions is free'))).toBe(true)
  })

  it('gates estimatedGbp at £0 for create-only plans while keeping export estimate', () => {
    const plan = buildVariantPlan({
      platforms: ['tiktok'],
      hookIndexes: [0],
      ctaIndexes: [0],
      includeRenders: false,
    })
    expect(plan.createEstimatedGbp).toBe(0)
    expect(plan.estimatedGbp).toBe(0)
    expect(plan.exportEstimatedGbp).toBe(VARIANT_RENDER_GBP)
  })

  it('truncates above soft cap without confirmSpend', () => {
    const plan = buildVariantPlan({
      platforms: ['tiktok', 'ig_reels', 'yt_shorts', 'meta_feed'],
      hookIndexes: [0, 1],
      ctaIndexes: [0, 1],
      softCap: 12,
    })
    expect(plan.requestedCount).toBe(16)
    expect(plan.items).toHaveLength(12)
    expect(plan.truncated).toBe(true)
  })
})

describe('resolveVariantCopy', () => {
  it('resolves hook and CTA from brief indexes', () => {
    const copy = resolveVariantCopy({
      spec: makeVariantSpec({ platform: 'tiktok', hookIndex: 1, ctaIndex: 0 }),
      brief: sampleBrief(),
    })
    expect(copy.hookText).toBe('Clarity for every launch')
    expect(copy.ctaText).toBe('Try Acme')
  })

  it('prefers overrides', () => {
    const copy = resolveVariantCopy({
      spec: makeVariantSpec({
        platform: 'tiktok',
        hookIndex: -1,
        ctaIndex: -1,
        hookOverride: 'Custom hook',
        ctaOverride: 'Custom CTA',
      }),
      brief: sampleBrief(),
    })
    expect(copy.hookText).toBe('Custom hook')
    expect(copy.ctaText).toBe('Custom CTA')
  })

  it('falls back to brand defaultCta when CTA candidates are empty', () => {
    const brief = sampleBrief()
    brief.messaging.ctaCandidates = []
    brief.brandCandidates.defaultCta = 'Shop now'
    const copy = resolveVariantCopy({
      spec: makeVariantSpec({ platform: 'tiktok', hookIndex: 0, ctaIndex: 0 }),
      brief,
    })
    expect(copy.ctaText).toBe('Shop now')
  })
})

describe('materializeVariantProject', () => {
  it('shares parent asset blob keys and applies hook/CTA + meta aspect', () => {
    let parent = createEmptyProject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      productId: 'demo',
      name: 'Parent cut',
    })
    parent = attachAsset(parent, {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      kind: 'image',
      blobKey: 'products/demo/uploads/logo.png',
      source: 'upload',
      probe: {},
    })
    // attachAsset bumps revision; materialize resets child to 1
    const spec = makeVariantSpec({ platform: 'meta_feed', hookIndex: 0, ctaIndex: 1 })
    expect(spec.aspect).toBe('1:1')
    const child = materializeVariantProject({
      parent,
      childId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      spec,
      brief: sampleBrief(),
    })
    expect(child.id).not.toBe(parent.id)
    expect(child.assets[0]?.blobKey).toBe('products/demo/uploads/logo.png')
    expect(child.assets[0]?.id).toBe(parent.assets[0]?.id)
    expect(child.width).toBe(1080)
    expect(child.height).toBe(1080)
    expect(child.compositionId).toBe('social-carousel')
    expect(child.overlays.some((o) => o.kind === 'hook_title' && o.text?.includes('Stop'))).toBe(
      true,
    )
    expect(child.overlays.some((o) => o.kind === 'end_card' && o.text?.includes('Book'))).toBe(true)
  })
})

describe('dimensionsForAspect', () => {
  it('maps 9:16 and 4:5', () => {
    expect(dimensionsForAspect('9:16')).toMatchObject({ width: 1080, height: 1920 })
    expect(dimensionsForAspect('4:5')).toMatchObject({ width: 1080, height: 1350 })
  })
})
