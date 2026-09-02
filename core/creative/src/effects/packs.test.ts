import { describe, expect, it } from 'vitest'
import { assertStylePackPublishable } from './license-gate'
import { applyStylePackPromptHints, suggestStylePackFromText } from './hints'
import { getStylePack, listStylePacks, cssFilterForPack, STYLE_PACK_IDS } from './packs'
import { applyFilterToClip } from './apply'
import { attachAsset, addClip } from '../project/operations'
import { createEmptyProject } from '../project/schema'

describe('style packs (ADR-0045)', () => {
  it('lists first-party ids from the typed registry', () => {
    expect(listStylePacks().map((pack) => pack.id)).toEqual([...STYLE_PACK_IDS])
    expect(listStylePacks().length).toBeGreaterThanOrEqual(10)
    for (const pack of listStylePacks()) {
      expect(pack.license).toBe('first-party')
    }
  })

  it('maps free-text to a pack without spend', () => {
    expect(suggestStylePackFromText('make it VHS')).toBe('vhs')
    expect(suggestStylePackFromText('teal orange cinematic')).toBe('cinematic-teal-orange')
    expect(suggestStylePackFromText('luxury perfume silk')).toBe('luxury-perfume')
    expect(suggestStylePackFromText('just a clean cut')).toBeNull()
  })

  it('appends prompt hints when a pack is active', () => {
    const next = applyStylePackPromptHints('founder at desk', 'vhs')
    expect(next).toContain('founder at desk')
    expect(next).toContain('VHS')
  })

  it('Approve allows first-party packs and fails closed on unknown ids', () => {
    expect(() => assertStylePackPublishable('vhs')).not.toThrow()
    expect(() => assertStylePackPublishable(null)).not.toThrow()
    expect(() => assertStylePackPublishable('marketplace-mystery')).toThrow(/unknown style pack/)
  })

  it('exposes a CSS filter string for catalog tiles', () => {
    const vhs = getStylePack('vhs')
    expect(vhs).toBeTruthy()
    expect(cssFilterForPack(vhs!)).toContain('contrast(')
    expect(cssFilterForPack(vhs!)).toContain('sepia(')
    expect(vhs?.sepia).toBeGreaterThan(0)
    expect(vhs?.vignette).toBeGreaterThan(0)
  })

  it('loads pack JSON files through the typed registry', () => {
    expect(getStylePack('vhs')?.label).toBe('VHS')
    expect(getStylePack('luxury-perfume')?.musicHints.length).toBeGreaterThan(0)
  })
})

describe('clip filters (ADR-0058)', () => {
  it('sets filterId on a clip and rejects unknown packs', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const assetId = '11111111-1111-4111-8111-111111111111'
    project = addClip(
      attachAsset(project, {
        id: assetId,
        kind: 'video',
        blobKey: 'local/a.mp4',
        source: 'upload',
        probe: { durationFrames: 90 },
      }),
      { assetId },
    )
    const graded = applyFilterToClip(project, {
      clipId: project.clips[0]!.id,
      filterId: 'vhs',
      intensity: 0.5,
    })
    expect(graded.clips[0]?.filterId).toBe('vhs')
    expect(graded.clips[0]?.filterIntensity).toBe(0.5)
    expect(() =>
      applyFilterToClip(project, { clipId: project.clips[0]!.id, filterId: 'marketplace-mystery' }),
    ).toThrow(/Unknown filter/)
  })
})
