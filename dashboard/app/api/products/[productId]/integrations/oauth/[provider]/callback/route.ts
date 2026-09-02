import { NextResponse } from 'next/server'
import {
  dashboardPublicUrl,
  exchangeOAuthCode,
  parseConnectableProvider,
  parseOAuthState,
  upsertIntegrationSecret,
} from '@synawood/creative/performance'
import { requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const outcomesUrl = (productId: string, query: Record<string, string>) => {
  const url = new URL('/settings/outcomes', `${dashboardPublicUrl()}/`)
  url.searchParams.set('productId', productId)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return url
}

export const GET = async (
  request: Request,
  context: { params: Promise<{ productId: string; provider: string }> },
) => {
  try {
    const { productId, provider: rawProvider } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const provider = parseConnectableProvider(rawProvider)
    const params = new URL(request.url).searchParams
    const err = params.get('error_description') ?? params.get('error')
    if (err) {
      return NextResponse.redirect(outcomesUrl(productId, { oauth: 'denied', reason: err }))
    }
    const code = params.get('code')?.trim() ?? ''
    const state = params.get('state')?.trim() ?? ''
    if (!code || !state) {
      return NextResponse.redirect(outcomesUrl(productId, { oauth: 'missing' }))
    }
    const { shop } = parseOAuthState({ state, productId, provider })
    const token = await exchangeOAuthCode({ provider, code, productId, shop })
    await upsertIntegrationSecret(access.supabase, {
      productId,
      provider,
      token,
      authKind: 'oauth',
    })
    return NextResponse.redirect(outcomesUrl(productId, { connected: provider }))
  } catch (error) {
    const { productId } = await context.params
    return NextResponse.redirect(
      outcomesUrl(productId, {
        oauth: 'error',
        reason: error instanceof Error ? error.message.slice(0, 180) : 'OAuth callback failed.',
      }),
    )
  }
}
