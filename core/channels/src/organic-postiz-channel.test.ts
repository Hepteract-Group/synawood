import { describe, expect, it } from 'vitest'
import { assertOrganicPostizChannel, ORGANIC_POSTIZ_CHANNELS } from './organic-postiz-channel'

describe('organic Postiz channels', () => {
  it('allows the v1 organic map and rejects ads and other Synawood channels', () => {
    expect([...ORGANIC_POSTIZ_CHANNELS]).toEqual([
      'x_founder',
      'linkedin_founder',
      'tiktok_organic',
    ])
    expect(assertOrganicPostizChannel('x_founder')).toBe('x_founder')
    expect(() => assertOrganicPostizChannel('google_search_ads')).toThrow(/google_search_ads/)
    expect(() => assertOrganicPostizChannel('blog_seo')).toThrow(/not a Postiz/)
  })
})
