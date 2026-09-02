import { describe, expect, it } from 'vitest'
import { createPostizPublishAdapter } from './postiz-publish'

describe('createPostizPublishAdapter', () => {
  it('does not treat unset POSTIZ_ADAPTER as mock', () => {
    expect(() => createPostizPublishAdapter({})).toThrow(/not configured/)
    expect(() => createPostizPublishAdapter({})).not.toThrow(/not_implemented/)
  })

  it('does not require URL or key on the mock path (CI)', () => {
    expect(() => createPostizPublishAdapter({ POSTIZ_ADAPTER: 'mock' })).not.toThrow()
  })

  it('fails closed with a readable sentence when live is selected and URL is missing', () => {
    expect(() =>
      createPostizPublishAdapter({
        POSTIZ_ADAPTER: 'live',
        POSTIZ_API_KEY: 'pos_test',
      }),
    ).toThrow(/POSTIZ_BASE_URL/)
  })

  it('fails closed with a readable sentence when live is selected and API key is missing', () => {
    expect(() =>
      createPostizPublishAdapter({
        POSTIZ_ADAPTER: 'live',
        POSTIZ_BASE_URL: 'https://api.postiz.com/public/v1',
      }),
    ).toThrow(/POSTIZ_API_KEY/)
  })

  it('rejects an unrecognised POSTIZ_ADAPTER instead of falling through to mock', () => {
    expect(() => createPostizPublishAdapter({ POSTIZ_ADAPTER: 'production' })).toThrow(
      /POSTIZ_ADAPTER/,
    )
    expect(() => createPostizPublishAdapter({ POSTIZ_ADAPTER: 'production' })).not.toThrow(
      /not_implemented/,
    )
  })

  it('constructs when live is selected and both URL and key are set', () => {
    expect(() =>
      createPostizPublishAdapter({
        POSTIZ_ADAPTER: 'live',
        POSTIZ_BASE_URL: 'https://api.postiz.com/public/v1',
        POSTIZ_API_KEY: 'pos_test',
      }),
    ).not.toThrow()
  })

  it('refuses mock schedule without injected HTTP so CI cannot hit a live host', async () => {
    const adapter = createPostizPublishAdapter({ POSTIZ_ADAPTER: 'mock' })
    await expect(
      adapter.schedule({
        productId: 'demo',
        finalAssetId: 'fa_1',
        channel: 'linkedin_founder',
      }),
    ).rejects.toThrow(/database client|fetchImpl|Blob reader/)
  })
})
