import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './schema'
import {
  buildCampaignBackgroundPrompt,
  planCampaignCreatives,
  setCampaignBrief,
  setCampaignCreative,
  setCreativeBackground,
  addCampaignCreative,
  clearCampaignCreativeMedia,
  removeCampaignCreative,
} from './campaign-ops'

const pack = () =>
  createEmptyProject({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    productId: 'demo',
    compositionId: 'campaign-pack-still',
  })

describe('campaign-ops (#110)', () => {
  it('saves brief ingredients without touching slides', () => {
    let project = pack()
    project = setCampaignBrief(project, {
      prompt: 'Quiet focus for PDF readers',
      aspect: '4:5',
      productId: 'demo',
      imageAssetIds: ['11111111-1111-4111-8111-111111111111'],
      suggestionSource: 'manual',
    })
    expect(project.campaignPack?.brief.prompt).toMatch(/Quiet focus/)
    expect(project.campaignPack?.brief.aspect).toBe('4:5')
    expect(project.campaignPack?.brief.imageAssetIds).toHaveLength(1)
    expect(project.slideshow).toBeUndefined()
  })

  it('plans creatives and patches one headline', () => {
    let project = pack()
    project = setCampaignBrief(project, { prompt: 'the private example campaign' })
    project = planCampaignCreatives(project, {
      headlines: ['Hook', 'Proof', 'CTA'],
    })
    expect(project.campaignPack?.creatives).toHaveLength(3)
    const id = project.campaignPack!.creatives[0]!.id
    project = setCampaignCreative(project, {
      creativeId: id,
      patch: { headline: 'Stronger hook', body: 'Edit without Adobe' },
    })
    expect(project.campaignPack!.creatives[0]!.headline).toBe('Stronger hook')
    project = setCreativeBackground(project, {
      creativeId: id,
      backgroundAssetId: '22222222-2222-4222-8222-222222222222',
    })
    expect(project.campaignPack!.creatives[0]!.backgroundAssetId).toBe(
      '22222222-2222-4222-8222-222222222222',
    )
  })

  it('rejects campaign ops on slideshow projects', () => {
    const slideshow = createEmptyProject({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      productId: 'demo',
      compositionId: 'social-carousel',
      slideshowPresetId: 'ig_carousel_1080',
    })
    expect(() => setCampaignBrief(slideshow, { prompt: 'nope' })).toThrow(/Campaign Pack/)
  })

  it('rewrites forbidden claims on creative headlines', () => {
    let project = pack()
    project = planCampaignCreatives(project, { headlines: ['Hook'] })
    const id = project.campaignPack!.creatives[0]!.id
    project = setCampaignCreative(project, {
      creativeId: id,
      patch: { headline: 'Guaranteed #1 PDF tool' },
    })
    expect(project.campaignPack!.creatives[0]!.headline.toLowerCase()).not.toMatch(/guaranteed/)
    expect(project.campaignPack!.creatives[0]!.headline.toLowerCase()).not.toMatch(/#\s*1/)
  })

  it('adds a blank creative', () => {
    let project = pack()
    project = addCampaignCreative(project, { headline: 'New line' })
    expect(project.campaignPack?.creatives).toHaveLength(1)
    expect(project.campaignPack?.creatives[0]?.headline).toBe('New line')
  })

  it('removes a creative and renumbers order', () => {
    let project = pack()
    project = planCampaignCreatives(project, { headlines: ['A', 'B', 'C'] })
    const mid = project.campaignPack!.creatives[1]!.id
    project = removeCampaignCreative(project, { creativeId: mid })
    expect(project.campaignPack?.creatives.map((c) => c.headline)).toEqual(['A', 'C'])
    expect(project.campaignPack?.creatives.map((c) => c.order)).toEqual([0, 1])
  })

  it('clears still and motion without dropping the card', () => {
    let project = pack()
    project = planCampaignCreatives(project, { headlines: ['Hook'] })
    const id = project.campaignPack!.creatives[0]!.id
    project = setCampaignCreative(project, {
      creativeId: id,
      patch: {
        backgroundAssetId: '22222222-2222-4222-8222-222222222222',
        motionAssetId: '33333333-3333-4333-8333-333333333333',
        motionJobId: '44444444-4444-4444-8444-444444444444',
      },
    })
    project = clearCampaignCreativeMedia(project, { creativeId: id })
    const creative = project.campaignPack!.creatives[0]!
    expect(creative.headline).toBe('Hook')
    expect(creative.backgroundAssetId).toBeUndefined()
    expect(creative.motionAssetId).toBeUndefined()
    expect(creative.motionJobId).toBeUndefined()
  })

  it('builds a bounded background prompt', () => {
    const prompt = buildCampaignBackgroundPrompt({
      briefPrompt: 'Calm desk',
      headline: 'Focus',
      notes: 'green',
    })
    expect(prompt).toMatch(/Calm desk/)
    expect(prompt.length).toBeLessThanOrEqual(800)
  })
})
