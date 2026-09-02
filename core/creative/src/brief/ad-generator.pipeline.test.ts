import { describe, expect, it } from 'vitest'
import { applyBriefMinimal } from './apply-brief'
import { loadBriefFixture } from './fixtures/load-fixture'
import { extractedBriefSchema, parseExtractedBrief } from './extracted-brief'
import { createEmptyProject } from '../project'
import { attachAsset } from '../project/operations'
import { buildVariantPlan, makeVariantSpec } from '../variant/plan'
import { materializeVariantProject } from '../variant/materialize'
import { applyPromoteFields } from '../variant/promote'

/**
 * Pure Wave 2B gold path (#160): fixture brief → apply → plan → materialize → promote.
 * No Supabase / network — exercises shared fixtures end to end.
 */
describe('ad generator pipeline (fixtures)', () => {
  it('round-trips URL and PDF brief fixtures through Zod', () => {
    const url = loadBriefFixture('acme-url-brief')
    const pdf = loadBriefFixture('acme-pdf-brief')
    expect(extractedBriefSchema.parse(url).id).toBe(url.id)
    expect(parseExtractedBrief(JSON.parse(JSON.stringify(pdf))).source.kind).toBe('pdf')
  })

  it('applies minimal first cut, fans out shared-media children, promotes winning copy', () => {
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

    const brief = loadBriefFixture('acme-url-brief')
    const applied = applyBriefMinimal({ project: parent, brief })
    expect(applied.modeUsed).toBe('minimal')
    expect(applied.project.brand?.displayName).toBe('Acme')
    parent = applied.project

    const plan = buildVariantPlan({
      platforms: ['tiktok', 'ig_reels'],
      hookIndexes: [0, 1],
      ctaIndexes: [0],
      softCap: 12,
    })
    expect(plan.truncated).toBe(false)
    expect(plan.items).toHaveLength(4)

    const children = plan.items.map((spec, index) =>
      materializeVariantProject({
        parent,
        childId: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
        spec,
        brief,
      }),
    )
    expect(children.every((child) => child.assets[0]?.blobKey === parent.assets[0]?.blobKey)).toBe(
      true,
    )
    expect(new Set(children.map((child) => child.id)).size).toBe(4)

    const winner = materializeVariantProject({
      parent,
      childId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      spec: makeVariantSpec({
        platform: 'tiktok',
        hookIndex: -1,
        ctaIndex: -1,
        hookOverride: 'Winning opening line',
        ctaOverride: 'Winning CTA',
      }),
      brief,
    })
    const promoted = applyPromoteFields({
      parent,
      child: winner,
      fields: ['hook', 'end_card'],
    })
    expect(promoted.project.overlays.find((o) => o.kind === 'hook_title')?.text).toBe(
      'Winning opening line',
    )
    expect(promoted.project.overlays.find((o) => o.kind === 'end_card')?.text).toBe('Winning CTA')
  })
})
