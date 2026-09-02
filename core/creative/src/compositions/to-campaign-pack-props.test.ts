import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createEmptyProject, draftCreatives, parseStudioProject } from '../project'
import { toCampaignPackStillProps } from './to-campaign-pack-props'

describe('toCampaignPackStillProps (#109)', () => {
  it('maps first creative headline and Path C brand fields', () => {
    const base = createEmptyProject({
      id: randomUUID(),
      productId: 'demo',
      compositionId: 'campaign-pack-still',
    })
    const bgId = randomUUID()
    const logoId = randomUUID()
    const project = parseStudioProject({
      ...base,
      brand: {
        productId: 'demo',
        primaryColor: '#112233',
        accentColor: '#445566',
        defaultCta: 'Try free',
        logoAssetId: logoId,
        chrome: { corner: 'bottom-left', scale: 1.1, safeMargin: 40 },
      },
      assets: [
        {
          id: bgId,
          kind: 'image',
          blobKey: 'local/bg.jpg',
          source: 'upload',
          probe: {},
        },
        {
          id: logoId,
          kind: 'image',
          blobKey: 'local/logo.png',
          source: 'brand_kit',
          probe: {},
        },
      ],
      campaignPack: {
        brief: { prompt: 'Launch', aspect: '1:1' },
        creatives: draftCreatives({ headlines: ['Open PDFs faster'] }).map((c) => ({
          ...c,
          backgroundAssetId: bgId,
          cta: 'Start now',
        })),
      },
    })

    const props = toCampaignPackStillProps(project, (key) => `https://cdn.test/${key}`)
    expect(props.headline).toBe('Open PDFs faster')
    expect(props.cta).toBe('Start now')
    expect(props.backgroundSrc).toBe('https://cdn.test/local/bg.jpg')
    expect(props.logoSrc).toBe('https://cdn.test/local/logo.png')
    expect(props.logoCorner).toBe('bottom-left')
    expect(props.primaryColor).toBe('#112233')
    expect(props.durationInFrames).toBe(1)
  })
})
