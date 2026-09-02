import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project/schema'
import {
  setCampaignBrief,
  planCampaignCreatives,
  setCreativeBackground,
} from '../project/campaign-ops'
import { estimateAnimateGbp, runAnimateCampaignCreative } from './animate-creative'
import type { StudioToolContext } from '../tools/types'

vi.mock('../tools/generator-tools', () => ({
  runGenerateVideoClipTool: vi.fn(async () => ({
    ok: true,
    summary: 'mock video',
    data: {
      assetId: '33333333-3333-4333-8333-333333333333',
      jobId: '44444444-4444-4444-8444-444444444444',
    },
  })),
}))

const makeCtx = (): StudioToolContext => {
  let project = createEmptyProject({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    productId: 'demo',
    compositionId: 'campaign-pack-still',
  })
  project = {
    ...project,
    brand: {
      productId: 'demo',
      displayName: 'the private example',
      primaryColor: '#1f6b4a',
      accentColor: '#c45c26',
      fontFamily: 'Georgia',
      stillAssetIds: [],
    },
  }
  project = setCampaignBrief(project, { prompt: 'Calm focus' })
  project = planCampaignCreatives(project, { headlines: ['Hook'] })
  project = setCreativeBackground(project, {
    creativeId: 'creative_1',
    backgroundAssetId: '11111111-1111-4111-8111-111111111111',
  })
  return {
    productId: 'demo',
    projectId: project.id,
    project,
    expectedRevision: project.revision,
    supabase: { from: vi.fn() } as never,
    blobEnv: {
      connectionString: 'x',
      containerName: 'marketing-os',
      useLocalPrefix: true,
      accountName: 'a',
      accountKey: 'k',
    },
    modelProfileId: 'ci-stub',
    persist: false,
    toolTrace: [],
  }
}

describe('animate campaign creative (#113)', () => {
  it('estimates £0 on ci-stub', () => {
    const estimate = estimateAnimateGbp({ modelProfileId: 'ci-stub', durationSeconds: 4 })
    expect(estimate.estimatedGbp).toBe(0)
  })

  it('attaches motionAssetId without marking Final', async () => {
    const ctx = makeCtx()
    const outcome = await runAnimateCampaignCreative(ctx, {
      creativeId: 'creative_1',
      withoutText: true,
      confirmSpend: true,
    })
    expect(outcome.ok).toBe(true)
    expect(ctx.project.campaignPack?.creatives[0]?.motionAssetId).toBe(
      '33333333-3333-4333-8333-333333333333',
    )
    expect(ctx.project.status).toBe('drafting')
    expect((outcome as { data?: { final?: boolean } }).data?.final).toBe(false)
  })

  it('requires confirmSpend when paid', async () => {
    const ctx = makeCtx()
    ctx.modelProfileId = 'cheap-draft'
    const blocked = await runAnimateCampaignCreative(ctx, {
      creativeId: 'creative_1',
    })
    expect(blocked.ok).toBe(false)
    expect(String((blocked as { error?: string }).error ?? '')).toMatch(/confirmSpend/)
  })
})
