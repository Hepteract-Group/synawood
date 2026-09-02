import { describe, expect, it } from 'vitest'
import {
  mapOrganicChannelToPostizType,
  POSTIZ_TYPE_ADS_COPY,
  POSTIZ_TYPE_NON_ORGANIC_COPY,
} from './postiz-settings-type'

describe('Postiz settings type map (#799)', () => {
  it('maps v1 organic Synawood channels to Postiz types', () => {
    expect(mapOrganicChannelToPostizType('x_founder')).toBe('x')
    expect(mapOrganicChannelToPostizType('tiktok_organic')).toBe('tiktok')
    expect(mapOrganicChannelToPostizType('linkedin_founder')).toBe('linkedin')
    expect(mapOrganicChannelToPostizType('linkedin_founder', { linkedinType: 'linkedin' })).toBe(
      'linkedin',
    )
    expect(
      mapOrganicChannelToPostizType('linkedin_founder', { linkedinType: 'linkedin-page' }),
    ).toBe('linkedin-page')
  })

  it('rejects ads with a loud error', () => {
    expect(() => mapOrganicChannelToPostizType('google_search_ads')).toThrow(POSTIZ_TYPE_ADS_COPY)
    expect(() => mapOrganicChannelToPostizType('meta_retargeting')).toThrow(POSTIZ_TYPE_ADS_COPY)
    expect(() => mapOrganicChannelToPostizType('linkedin_ads')).toThrow(POSTIZ_TYPE_ADS_COPY)
    expect(() => mapOrganicChannelToPostizType('apple_search_ads')).toThrow(POSTIZ_TYPE_ADS_COPY)
  })

  it('rejects blog, email, and later social maps with a loud error', () => {
    expect(() => mapOrganicChannelToPostizType('blog_seo')).toThrow(POSTIZ_TYPE_NON_ORGANIC_COPY)
    expect(() => mapOrganicChannelToPostizType('email_onboarding')).toThrow(
      POSTIZ_TYPE_NON_ORGANIC_COPY,
    )
    expect(() => mapOrganicChannelToPostizType('instagram')).toThrow(POSTIZ_TYPE_NON_ORGANIC_COPY)
    expect(() => mapOrganicChannelToPostizType('youtube')).toThrow(POSTIZ_TYPE_NON_ORGANIC_COPY)
    expect(() => mapOrganicChannelToPostizType('threads')).toThrow(POSTIZ_TYPE_NON_ORGANIC_COPY)
  })
})
