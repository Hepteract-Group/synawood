import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertOrganicPostizChannel,
  isOrganicPostizChannel,
  isPostizProviderForChannel,
  ORGANIC_POSTIZ_CHANNEL_LABEL,
  ORGANIC_POSTIZ_CHANNELS,
  type OrganicPostizChannel,
  type PostizProvider,
  type ProductChannelIntegration,
} from './organic-postiz-channel'
import { publishChannelSchema, type PublishChannel } from './publish-port'

export type PostizIntegration = {
  id: string
  name: string
  provider: PostizProvider
}

export const ADS_POSTIZ_BIND_COPY =
  'Paid ads (Google, Meta, LinkedIn Ads, Apple) are not posted through Postiz. After you Approve a Final, open its card on the Work board and paste the live URL from the ads tool.'

export const NON_ORGANIC_POSTIZ_BIND_COPY =
  'This channel cannot use Postiz. Bind only X, LinkedIn, or TikTok. For paid ads, blog, and email, open the Final’s card on the Work board and paste the live URL.'

export const POSTIZ_ORGANIC_SCOPE_NOTE =
  'Postiz posts organic X, LinkedIn, and TikTok. Paid ads (Google, Meta, LinkedIn Ads, Apple), plus blog and email, stay in their own tools. After you Approve a Final, open its card on the Work board to Schedule, Post now, or paste a live URL.'

export const ACCOUNT_NOT_CONNECTED_COPY = 'That Postiz account is not connected.'

export const PICK_CONNECTED_ACCOUNT_COPY = 'Pick a connected Postiz account.'

export const CHANNEL_BIND_ERROR = 'ChannelBindError'

export type ChannelBindError = Error & {
  name: typeof CHANNEL_BIND_ERROR
  status: 400
}

export const isChannelBindError = (error: unknown): error is ChannelBindError =>
  error instanceof Error && error.name === CHANNEL_BIND_ERROR

const bindError = (message: string): ChannelBindError => {
  const error = new Error(message) as ChannelBindError
  error.name = CHANNEL_BIND_ERROR
  error.status = 400
  return error
}

const ADS_PUBLISH_CHANNELS = new Set<PublishChannel>([
  'google_search_ads',
  'meta_retargeting',
  'linkedin_ads',
  'apple_search_ads',
])

const isAdsPublishChannel = (channel: string): boolean => {
  const parsed = publishChannelSchema.safeParse(channel)
  return parsed.success && ADS_PUBLISH_CHANNELS.has(parsed.data)
}

const SELECT = 'id, product_id, channel, postiz_integration_id, created_at, updated_at'

const mentionsChannelIntegrationsTable = (message: string): boolean =>
  /product_channel_integrations/i.test(message)

const isMissingRelationSignal = (message: string): boolean => {
  if (/column .+ of relation/i.test(message)) return false
  return (
    /42P01/i.test(message) ||
    /could not find the table/i.test(message) ||
    /relation ["']product_channel_integrations["'] does not exist/i.test(message)
  )
}

export const isMissingChannelIntegrationsSchema = (message: string): boolean =>
  mentionsChannelIntegrationsTable(message) && isMissingRelationSignal(message)

export const isPostizLiveConfigured = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.POSTIZ_ADAPTER?.trim().toLowerCase() === 'live' &&
  Boolean(env.POSTIZ_BASE_URL?.trim()) &&
  Boolean(env.POSTIZ_API_KEY?.trim())

export type ChannelIntegrationsPayload = {
  integrations: PostizIntegration[]
  bindings: ProductChannelIntegration[]
  unboundChannels: OrganicPostizChannel[]
  canEdit: boolean
  postizConfigured: boolean
  postizAppUrl: string | null
  schemaMissing?: boolean
}

export const channelIntegrationsPayload = (input: {
  integrations: PostizIntegration[]
  bindings: ProductChannelIntegration[]
  canEdit: boolean
  postizConfigured?: boolean
  postizAppUrl?: string | null
  schemaMissing?: boolean
}): ChannelIntegrationsPayload => {
  const bound = new Set(input.bindings.map((row) => row.channel))
  return {
    integrations: input.integrations,
    bindings: input.bindings,
    unboundChannels: ORGANIC_POSTIZ_CHANNELS.filter((channel) => !bound.has(channel)),
    canEdit: input.canEdit,
    postizConfigured: input.postizConfigured ?? isPostizLiveConfigured(),
    postizAppUrl: input.postizAppUrl ?? null,
    ...(input.schemaMissing ? { schemaMissing: true as const } : {}),
  }
}

const joinApiUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.trim().replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

const isV1PostizProvider = (value: string): value is PostizProvider =>
  value === 'x' || value === 'linkedin' || value === 'linkedin-page' || value === 'tiktok'

/** Public API root → operator UI. Cloud API host is not the app. */
export const postizAppUrlFromApiRoot = (baseUrl: string): string | null => {
  const trimmed = baseUrl.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.hostname === 'api.postiz.com') return 'https://platform.postiz.com'
    const path = url.pathname.replace(/\/+$/, '').replace(/\/(?:api\/)?public\/v1$/i, '')
    url.pathname = path || '/'
    url.search = ''
    url.hash = ''
    const href = url.toString().replace(/\/$/, '')
    return href || url.origin
  } catch {
    return null
  }
}

export const parsePostizIntegrationsBody = (body: unknown): PostizIntegration[] => {
  const rows = Array.isArray(body)
    ? body
    : body &&
        typeof body === 'object' &&
        Array.isArray((body as { integrations?: unknown }).integrations)
      ? (body as { integrations: unknown[] }).integrations
      : []
  const out: PostizIntegration[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    if (rec.disabled === true) continue
    const id = typeof rec.id === 'string' ? rec.id.trim() : ''
    const name = typeof rec.name === 'string' ? rec.name.trim() : ''
    const identifier = typeof rec.identifier === 'string' ? rec.identifier.trim() : ''
    if (!id || !name || !isV1PostizProvider(identifier)) continue
    out.push({ id, name, provider: identifier })
  }
  return out
}

export const assertBindablePostizChannel = (channel: string): OrganicPostizChannel => {
  if (isAdsPublishChannel(channel)) {
    throw bindError(ADS_POSTIZ_BIND_COPY)
  }
  if (!isOrganicPostizChannel(channel)) {
    throw bindError(NON_ORGANIC_POSTIZ_BIND_COPY)
  }
  return assertOrganicPostizChannel(channel)
}

const alreadyBoundCopy = (channel: OrganicPostizChannel): string =>
  `That Postiz account is already bound to ${ORGANIC_POSTIZ_CHANNEL_LABEL[channel]}. Unbind it first.`

const wrongProviderCopy = (channel: OrganicPostizChannel): string =>
  `${ORGANIC_POSTIZ_CHANNEL_LABEL[channel]} can only bind a matching account.`

export const isUniqueAccountConstraint = (message: string): boolean =>
  /23505/i.test(message) || /product_channel_integrations_product_integration_key/i.test(message)

/**
 * Live GET /integrations when the live adapter is configured.
 * Fail closed to [] (never mock fixture names). Vitest must inject fetchImpl (ADR-0064).
 */
export const listPostizIntegrations = async (input?: {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}): Promise<PostizIntegration[]> => {
  if (process.env.VITEST && !input?.fetchImpl) return []
  const env = input?.env ?? process.env
  if (!isPostizLiveConfigured(env)) return []
  const baseUrl = env.POSTIZ_BASE_URL?.trim() ?? ''
  const apiKey = env.POSTIZ_API_KEY?.trim() ?? ''
  const fetchImpl = input?.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(joinApiUrl(baseUrl, 'integrations'), {
      headers: { Authorization: apiKey, Accept: 'application/json' },
    })
    if (!response.ok) return []
    return parsePostizIntegrationsBody(await response.json().catch(() => null))
  } catch {
    return []
  }
}

const toProductChannelIntegration = (row: Record<string, unknown>): ProductChannelIntegration => ({
  id: String(row.id),
  productId: String(row.product_id),
  channel: assertOrganicPostizChannel(String(row.channel)),
  postizIntegrationId: String(row.postiz_integration_id),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
})

export const listProductChannelIntegrations = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<ProductChannelIntegration[]> => {
  const { data, error } = await supabase
    .from('product_channel_integrations')
    .select(SELECT)
    .eq('product_id', productId)
    .order('channel')
  if (error) throw new Error(`List channel bindings failed: ${error.message}`)
  return (data ?? []).map((row) => toProductChannelIntegration(row))
}

export const bindProductChannelIntegration = async (input: {
  supabase: SupabaseClient
  productId: string
  channel: string
  postizIntegrationId: string
  integrations?: PostizIntegration[]
  bindings?: ProductChannelIntegration[]
}): Promise<ProductChannelIntegration> => {
  const channel = assertBindablePostizChannel(input.channel)
  const postizIntegrationId = input.postizIntegrationId.trim()
  if (!postizIntegrationId) {
    throw bindError(PICK_CONNECTED_ACCOUNT_COPY)
  }
  const integrations = input.integrations ?? (await listPostizIntegrations())
  const connected = integrations.find((row) => row.id === postizIntegrationId)
  if (!connected) {
    throw bindError(ACCOUNT_NOT_CONNECTED_COPY)
  }
  if (!isPostizProviderForChannel(channel, connected.provider)) {
    throw bindError(wrongProviderCopy(channel))
  }
  const existing =
    input.bindings ?? (await listProductChannelIntegrations(input.supabase, input.productId))
  const taken = existing.find(
    (row) => row.postizIntegrationId === postizIntegrationId && row.channel !== channel,
  )
  if (taken) {
    throw bindError(alreadyBoundCopy(taken.channel))
  }
  const { data, error } = await input.supabase
    .from('product_channel_integrations')
    .upsert(
      {
        product_id: input.productId,
        channel,
        postiz_integration_id: postizIntegrationId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id,channel' },
    )
    .select(SELECT)
    .single()
  if (error) {
    if (isUniqueAccountConstraint(error.message)) {
      const latest = await listProductChannelIntegrations(input.supabase, input.productId)
      const holder = latest.find(
        (row) => row.postizIntegrationId === postizIntegrationId && row.channel !== channel,
      )
      throw bindError(alreadyBoundCopy(holder?.channel ?? channel))
    }
    throw new Error(`Bind channel failed: ${error.message}`)
  }
  return toProductChannelIntegration(data)
}

export const unbindProductChannelIntegration = async (input: {
  supabase: SupabaseClient
  productId: string
  channel: string
}): Promise<void> => {
  const channel = assertBindablePostizChannel(input.channel)
  const { error } = await input.supabase
    .from('product_channel_integrations')
    .delete()
    .eq('product_id', input.productId)
    .eq('channel', channel)
  if (error) throw new Error(`Unbind channel failed: ${error.message}`)
}
