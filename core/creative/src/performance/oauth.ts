/** OAuth start URLs for performance integrations (ADR-0035 / #246). No live spend. */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { integrationProviderSchema, type IntegrationProvider } from './schema'
import { readPerformanceTokenKey } from './encrypt'

export const CONNECTABLE_PROVIDERS = [
  'tiktok',
  'meta',
  'youtube',
  'linkedin',
  'shopify',
  'stripe',
] as const

export type ConnectableProvider = (typeof CONNECTABLE_PROVIDERS)[number]

type ProviderOAuth = {
  authorizeUrl: string
  tokenUrl: string
  scopes: string
  clientIdEnv: string
  clientSecretEnv: string
  clientIdParam?: string
  extra?: Record<string, string>
}

const PROVIDERS: Record<ConnectableProvider, ProviderOAuth> = {
  tiktok: {
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: 'user.info.basic',
    clientIdEnv: 'TIKTOK_CLIENT_ID',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    clientIdParam: 'client_key',
  },
  meta: {
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: 'pages_show_list,pages_read_engagement',
    clientIdEnv: 'META_CLIENT_ID',
    clientSecretEnv: 'META_CLIENT_SECRET',
  },
  youtube: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/youtube.readonly',
    clientIdEnv: 'YOUTUBE_CLIENT_ID',
    clientSecretEnv: 'YOUTUBE_CLIENT_SECRET',
    extra: { access_type: 'offline', prompt: 'consent' },
  },
  linkedin: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: 'r_organization_social',
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
  },
  shopify: {
    authorizeUrl: 'https://{shop}/admin/oauth/authorize',
    tokenUrl: 'https://{shop}/admin/oauth/access_token',
    scopes: 'read_orders,read_analytics',
    clientIdEnv: 'SHOPIFY_CLIENT_ID',
    clientSecretEnv: 'SHOPIFY_CLIENT_SECRET',
  },
  stripe: {
    authorizeUrl: 'https://connect.stripe.com/oauth/authorize',
    tokenUrl: 'https://connect.stripe.com/oauth/token',
    scopes: 'read_only',
    clientIdEnv: 'STRIPE_CLIENT_ID',
    clientSecretEnv: 'STRIPE_CLIENT_SECRET',
  },
}

export const isConnectableProvider = (raw: string): raw is ConnectableProvider =>
  CONNECTABLE_PROVIDERS.includes(raw as ConnectableProvider)

export const parseConnectableProvider = (raw: string): ConnectableProvider => {
  const parsed = integrationProviderSchema.safeParse(raw)
  if (!parsed.success || !isConnectableProvider(parsed.data)) {
    throw new Error(`Unknown integration provider: ${raw}`)
  }
  return parsed.data
}

export const oauthClientId = (
  provider: ConnectableProvider,
  env: NodeJS.ProcessEnv = process.env,
): string => (env[PROVIDERS[provider].clientIdEnv] ?? '').trim()

export const oauthClientSecret = (
  provider: ConnectableProvider,
  env: NodeJS.ProcessEnv = process.env,
): string => (env[PROVIDERS[provider].clientSecretEnv] ?? '').trim()

export const oauthIsConfigured = (
  provider: ConnectableProvider,
  env: NodeJS.ProcessEnv = process.env,
): boolean => Boolean(oauthClientId(provider, env) && oauthClientSecret(provider, env))

export const dashboardPublicUrl = (env: NodeJS.ProcessEnv = process.env): string =>
  (
    env.DASHBOARD_PUBLIC_URL?.trim() ||
    env.SMOKE_BASE_URL?.trim() ||
    'http://127.0.0.1:3011'
  ).replace(/\/$/, '')

export const oauthCallbackUrl = (input: {
  productId: string
  provider: ConnectableProvider
  env?: NodeJS.ProcessEnv
}): string =>
  `${dashboardPublicUrl(input.env)}/api/products/${encodeURIComponent(input.productId)}/integrations/oauth/${input.provider}/callback`

const sign = (payload: string, keyHex: string): string =>
  createHmac('sha256', keyHex).update(payload).digest('hex')

export const signOAuthState = (input: {
  productId: string
  provider: ConnectableProvider
  shop?: string
  nowMs?: number
  keyHex?: string | null
}): string => {
  const key = input.keyHex ?? readPerformanceTokenKey()
  if (!key) {
    throw new Error('PERFORMANCE_TOKEN_KEY is not set. OAuth is locked until the operator adds it.')
  }
  const exp = (input.nowMs ?? Date.now()) + 15 * 60_000
  const body = `${input.productId}|${input.provider}|${exp}|${input.shop ?? ''}`
  return `${body}|${sign(body, key)}`
}

export const parseOAuthState = (input: {
  state: string
  productId: string
  provider: ConnectableProvider
  nowMs?: number
  keyHex?: string | null
}): { shop: string } => {
  const key = input.keyHex ?? readPerformanceTokenKey()
  if (!key) {
    throw new Error('PERFORMANCE_TOKEN_KEY is not set. OAuth is locked until the operator adds it.')
  }
  const parts = input.state.split('|')
  if (parts.length !== 5) throw new Error('OAuth state is malformed.')
  const [productId, provider, expRaw, shop, mac] = parts
  const body = `${productId}|${provider}|${expRaw}|${shop}`
  const expected = sign(body, key)
  const left = Buffer.from(mac ?? '', 'utf8')
  const right = Buffer.from(expected, 'utf8')
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error('OAuth state signature failed.')
  }
  if (productId !== input.productId || provider !== input.provider) {
    throw new Error('OAuth state does not match this product.')
  }
  if (Number(expRaw) < (input.nowMs ?? Date.now())) {
    throw new Error('OAuth state expired. Start Connect again.')
  }
  return { shop: shop ?? '' }
}

export const buildAuthorizeUrl = (input: {
  productId: string
  provider: ConnectableProvider
  shop?: string
  env?: NodeJS.ProcessEnv
  state: string
}): string => {
  const env = input.env ?? process.env
  const spec = PROVIDERS[input.provider]
  if (!oauthIsConfigured(input.provider, env)) {
    throw new Error(
      `${spec.clientIdEnv} / ${spec.clientSecretEnv} unset. Paste a token on Outcomes, or set both OAuth app ids.`,
    )
  }
  const clientId = oauthClientId(input.provider, env)
  if (input.provider === 'shopify' && !input.shop?.trim()) {
    throw new Error('Shopify Connect needs the shop subdomain (e.g. demo.myshopify.com).')
  }
  const authorizeUrl =
    input.provider === 'shopify'
      ? spec.authorizeUrl.replace('{shop}', input.shop!.trim())
      : spec.authorizeUrl
  const idParam = spec.clientIdParam ?? 'client_id'
  const params = new URLSearchParams({
    [idParam]: clientId,
    redirect_uri: oauthCallbackUrl({
      productId: input.productId,
      provider: input.provider,
      env,
    }),
    response_type: 'code',
    scope: spec.scopes,
    state: input.state,
    ...spec.extra,
  })
  return `${authorizeUrl}?${params.toString()}`
}

export const exchangeOAuthCode = async (input: {
  provider: ConnectableProvider
  code: string
  productId: string
  shop?: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}): Promise<string> => {
  const env = input.env ?? process.env
  const spec = PROVIDERS[input.provider]
  const clientId = oauthClientId(input.provider, env)
  const clientSecret = oauthClientSecret(input.provider, env)
  if (!clientId || !clientSecret) {
    throw new Error('OAuth app is not configured. Paste a token instead.')
  }
  const tokenUrl =
    input.provider === 'shopify'
      ? spec.tokenUrl.replace('{shop}', (input.shop ?? '').trim())
      : spec.tokenUrl
  const runFetch = input.fetchImpl ?? fetch
  const response = await runFetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: oauthCallbackUrl({
        productId: input.productId,
        provider: input.provider,
        env,
      }),
    }),
  })
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string
    error?: string
    error_description?: string
  }
  const token = body.access_token?.trim() ?? ''
  if (!response.ok || !token) {
    throw new Error(body.error_description ?? body.error ?? 'OAuth token exchange failed.')
  }
  return token
}

export const oauthStatusForProviders = (
  env: NodeJS.ProcessEnv = process.env,
): Record<ConnectableProvider, boolean> =>
  Object.fromEntries(
    CONNECTABLE_PROVIDERS.map((provider) => [provider, oauthIsConfigured(provider, env)]),
  ) as Record<ConnectableProvider, boolean>
