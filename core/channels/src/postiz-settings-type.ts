import { isOrganicPostizChannel, type OrganicPostizChannel } from './organic-postiz-channel'
import { ADS_POSTIZ_BIND_COPY, NON_ORGANIC_POSTIZ_BIND_COPY } from './postiz-channel-bind'

export type PostizSettingsType = 'x' | 'linkedin' | 'linkedin-page' | 'tiktok'

export type LinkedinPostizType = Extract<PostizSettingsType, 'linkedin' | 'linkedin-page'>

/** Synawood ads types stay on paste-URL. `meta_retargeting` is the only ads id without an `_ads` suffix. */
const isAdsChannel = (channel: string): boolean =>
  channel.endsWith('_ads') || channel === 'meta_retargeting'

const DEFAULT_POSTIZ_TYPE = {
  x_founder: 'x',
  linkedin_founder: 'linkedin',
  tiktok_organic: 'tiktok',
} as const satisfies Record<OrganicPostizChannel, PostizSettingsType>

export const POSTIZ_TYPE_ADS_COPY = ADS_POSTIZ_BIND_COPY

export const POSTIZ_TYPE_NON_ORGANIC_COPY = NON_ORGANIC_POSTIZ_BIND_COPY

export type MapOrganicChannelToPostizTypeOptions = {
  linkedinType?: LinkedinPostizType
}

/** `channel` is a string so Settings/API can pass unknown ids (Instagram is not v1). */
export const mapOrganicChannelToPostizType = (
  channel: string,
  options?: MapOrganicChannelToPostizTypeOptions,
): PostizSettingsType => {
  if (isAdsChannel(channel)) {
    throw new Error(POSTIZ_TYPE_ADS_COPY)
  }
  if (!isOrganicPostizChannel(channel)) {
    throw new Error(POSTIZ_TYPE_NON_ORGANIC_COPY)
  }
  if (channel === 'linkedin_founder') {
    return options?.linkedinType ?? DEFAULT_POSTIZ_TYPE.linkedin_founder
  }
  return DEFAULT_POSTIZ_TYPE[channel]
}
