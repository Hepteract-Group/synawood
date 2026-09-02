import type { PublishChannel } from '@synawood/channels'

const CHANNEL_LABEL: Record<PublishChannel, string> = {
  linkedin_founder: 'LinkedIn',
  x_founder: 'X',
  blog_seo: 'Blog',
  tiktok_organic: 'TikTok',
  email_onboarding: 'Email',
  google_search_ads: 'Google Ads',
  meta_retargeting: 'Meta',
  linkedin_ads: 'LinkedIn Ads',
  apple_search_ads: 'Apple Ads',
}

export const channelLabel = (channel: string): string =>
  CHANNEL_LABEL[channel as PublishChannel] ?? channel
