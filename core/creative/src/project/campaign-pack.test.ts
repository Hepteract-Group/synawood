import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { draftCreatives, emptyCampaignPackExtras, validateCampaignPack } from './campaign-pack'
import { createEmptyProject, isCampaignPackComposition, parseStudioProject } from './schema'

describe('campaign pack schema (#109)', () => {
  it('createEmptyProject seeds campaignPack for campaign-pack-still', () => {
    const project = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'campaign-pack-still',
    })
    expect(isCampaignPackComposition(project.compositionId)).toBe(true)
    expect(project.campaignPack).toEqual(emptyCampaignPackExtras())
    expect(project.slideshow).toBeUndefined()
    expect(project.width).toBe(1080)
    expect(project.height).toBe(1080)
    expect(project.durationFrames).toBe(1)
  })

  it('round-trips creatives without colliding with slides[]', () => {
    const base = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'campaign-pack-still',
    })
    const creatives = draftCreatives({ headlines: ['Hook A', 'Hook B'] })
    const parsed = parseStudioProject({
      ...base,
      campaignPack: { brief: { prompt: 'Summer sale', aspect: '1:1' }, creatives },
    })
    expect(parsed.campaignPack?.creatives).toHaveLength(2)
    expect(parsed.slideshow).toBeUndefined()
    expect('slides' in (parsed.campaignPack ?? {})).toBe(false)
  })

  it('validateCampaignPack flags order gaps', () => {
    const extras = emptyCampaignPackExtras()
    extras.creatives = draftCreatives({ count: 2 })
    extras.creatives[1]!.order = 3
    expect(validateCampaignPack(extras).ok).toBe(false)
  })

  it('rejects unknown composition ids', () => {
    expect(() =>
      createEmptyProject({
        id: randomUUID(),
        productId: 'demo',
        compositionId: 'not-a-real-comp' as never,
      }),
    ).toThrow(/Unknown composition/)
  })
})
