import type { PublishChannel } from './publish-port'

export const ORGANIC_POSTIZ_CHANNELS = [
  'x_founder',
  'linkedin_founder',
  'tiktok_organic',
] as const satisfies readonly PublishChannel[]

export type OrganicPostizChannel = (typeof ORGANIC_POSTIZ_CHANNELS)[number]

export const ORGANIC_POSTIZ_CHANNEL_LABEL: Record<OrganicPostizChannel, string> = {
  x_founder: 'X',
  linkedin_founder: 'LinkedIn',
  tiktok_organic: 'TikTok',
}

export type PostizProvider = 'x' | 'linkedin' | 'linkedin-page' | 'tiktok'

export const POSTIZ_PROVIDERS_FOR_CHANNEL: Record<OrganicPostizChannel, readonly PostizProvider[]> =
  {
    x_founder: ['x'],
    linkedin_founder: ['linkedin', 'linkedin-page'],
    tiktok_organic: ['tiktok'],
  }

export const isPostizProviderForChannel = (
  channel: OrganicPostizChannel,
  provider: string,
): provider is PostizProvider =>
  (POSTIZ_PROVIDERS_FOR_CHANNEL[channel] as readonly string[]).includes(provider)

export const integrationsForOrganicChannel = <T extends { id: string; provider: string }>(
  channel: OrganicPostizChannel,
  integrations: T[],
  bindings: { channel: OrganicPostizChannel; postizIntegrationId: string }[],
): T[] => {
  const taken = new Set(
    bindings.filter((row) => row.channel !== channel).map((row) => row.postizIntegrationId),
  )
  return integrations.filter(
    (row) => isPostizProviderForChannel(channel, row.provider) && !taken.has(row.id),
  )
}

export type ProductChannelIntegration = {
  id: string
  productId: string
  channel: OrganicPostizChannel
  postizIntegrationId: string
  createdAt: string
  updatedAt: string
}

const organicSet = new Set<string>(ORGANIC_POSTIZ_CHANNELS)

export const isOrganicPostizChannel = (channel: string): channel is OrganicPostizChannel =>
  organicSet.has(channel)

export const assertOrganicPostizChannel = (channel: string): OrganicPostizChannel => {
  if (!isOrganicPostizChannel(channel)) {
    throw new Error(`${channel} is not a Postiz v1 organic channel`)
  }
  return channel
}
