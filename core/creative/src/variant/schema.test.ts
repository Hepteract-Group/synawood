import { describe, expect, it } from 'vitest'
import {
  VARIANT_SOFT_CAP,
  defaultAspectForPlatform,
  formatVariantLabel,
  parseVariantSpec,
  planVariantMatrix,
  stampVariantSourceBranch,
  suggestedCompositionForPlatform,
  variantSpecSchema,
} from './schema'

describe('variantSpecSchema', () => {
  it('parses a valid spec', () => {
    const spec = parseVariantSpec({
      platform: 'tiktok',
      hookIndex: 0,
      ctaIndex: 1,
      aspect: '9:16',
      label: 'TikTok · Hook 1 · CTA 2',
    })
    expect(spec.platform).toBe('tiktok')
    expect(spec.aspect).toBe('9:16')
  })

  it('allows override strings with index -1', () => {
    const spec = parseVariantSpec({
      platform: 'meta_feed',
      hookIndex: -1,
      ctaIndex: -1,
      hookOverride: 'Custom hook',
      ctaOverride: 'Shop now',
      aspect: '1:1',
      label: 'Meta · custom',
    })
    expect(spec.hookOverride).toBe('Custom hook')
    expect(spec.aspect).toBe('1:1')
  })

  it('accepts optional sourceBranchId (#188)', () => {
    const branchId = '33333333-3333-4333-8333-333333333333'
    const spec = parseVariantSpec({
      platform: 'tiktok',
      hookIndex: 0,
      ctaIndex: 0,
      aspect: '9:16',
      label: 'TikTok · Hook 1 · CTA 1',
      sourceBranchId: branchId,
    })
    expect(spec.sourceBranchId).toBe(branchId)
  })

  it('stampVariantSourceBranch is a no-op without an id', () => {
    const base = parseVariantSpec({
      platform: 'tiktok',
      hookIndex: 0,
      ctaIndex: 0,
      aspect: '9:16',
      label: 'TikTok · Hook 1 · CTA 1',
    })
    expect(stampVariantSourceBranch(base, null).sourceBranchId).toBeUndefined()
    expect(stampVariantSourceBranch(base, undefined)).toBe(base)
  })

  it('stampVariantSourceBranch sets the parent tip id', () => {
    const branchId = '33333333-3333-4333-8333-333333333333'
    const base = parseVariantSpec({
      platform: 'tiktok',
      hookIndex: 0,
      ctaIndex: 0,
      aspect: '9:16',
      label: 'TikTok · Hook 1 · CTA 1',
    })
    expect(stampVariantSourceBranch(base, branchId).sourceBranchId).toBe(branchId)
  })

  it('requires overrides when indexes are -1', () => {
    expect(() =>
      variantSpecSchema.parse({
        platform: 'tiktok',
        hookIndex: -1,
        ctaIndex: 0,
        aspect: '9:16',
        label: 'broken',
      }),
    ).toThrow(/hookOverride/)
    expect(() =>
      variantSpecSchema.parse({
        platform: 'tiktok',
        hookIndex: 0,
        ctaIndex: -1,
        aspect: '9:16',
        label: 'broken',
      }),
    ).toThrow(/ctaOverride/)
  })

  it('rejects unknown platform', () => {
    expect(() =>
      variantSpecSchema.parse({
        platform: 'linkedin',
        hookIndex: 0,
        ctaIndex: 0,
        aspect: '9:16',
        label: 'x',
      }),
    ).toThrow()
  })
})

describe('defaultAspectForPlatform', () => {
  it('maps shorts platforms to 9:16 and meta_feed to 1:1', () => {
    expect(defaultAspectForPlatform('tiktok')).toBe('9:16')
    expect(defaultAspectForPlatform('ig_reels')).toBe('9:16')
    expect(defaultAspectForPlatform('yt_shorts')).toBe('9:16')
    expect(defaultAspectForPlatform('meta_feed')).toBe('1:1')
  })
})

describe('suggestedCompositionForPlatform', () => {
  it('suggests talking-head for shorts and social-carousel for meta', () => {
    expect(suggestedCompositionForPlatform('tiktok')).toBe('talking-head-60')
    expect(suggestedCompositionForPlatform('meta_feed')).toBe('social-carousel')
  })
})

describe('formatVariantLabel', () => {
  it('builds a human label', () => {
    expect(formatVariantLabel({ platform: 'ig_reels', hookIndex: 0, ctaIndex: 1 })).toBe(
      'IG Reels · Hook 1 · CTA 2',
    )
  })
})

describe('planVariantMatrix', () => {
  it('cartesian-products platforms × hooks × ctas with default aspects', () => {
    const plan = planVariantMatrix({
      platforms: ['tiktok', 'meta_feed'],
      hookIndexes: [0, 1],
      ctaIndexes: [0],
    })
    expect(plan.items).toHaveLength(4)
    expect(plan.items.every((item) => item.label.length > 0)).toBe(true)
    expect(plan.items.filter((item) => item.platform === 'meta_feed')[0]?.aspect).toBe('1:1')
    expect(plan.truncated).toBe(false)
  })

  it('truncates to soft cap and sets truncated flag', () => {
    const hooks = Array.from({ length: 5 }, (_, i) => i)
    const ctas = Array.from({ length: 3 }, (_, i) => i)
    const plan = planVariantMatrix({
      platforms: ['tiktok', 'ig_reels', 'yt_shorts'],
      hookIndexes: hooks,
      ctaIndexes: ctas,
    })
    // 3 × 5 × 3 = 45 → soft cap
    expect(plan.items).toHaveLength(VARIANT_SOFT_CAP)
    expect(plan.truncated).toBe(true)
    expect(plan.requestedCount).toBe(45)
  })
})
