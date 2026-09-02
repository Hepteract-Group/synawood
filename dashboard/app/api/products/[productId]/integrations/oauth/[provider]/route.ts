import {
  buildAuthorizeUrl,
  dashboardPublicUrl,
  parseConnectableProvider,
  signOAuthState,
} from '@synawood/creative/performance'
import { requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const failToOutcomes = (productId: string, reason: string) => {
  const url = new URL('/settings/outcomes', `${dashboardPublicUrl()}/`)
  url.searchParams.set('oauth', 'error')
  url.searchParams.set('reason', reason.slice(0, 180))
  url.searchParams.set('productId', productId)
  return Response.redirect(url, 302)
}

export const GET = async (
  request: Request,
  context: { params: Promise<{ productId: string; provider: string }> },
) => {
  const { productId, provider: rawProvider } = await context.params
  try {
    await requireStudioAccess({ productId, minRole: 'editor' })
    const provider = parseConnectableProvider(rawProvider)
    const shop = new URL(request.url).searchParams.get('shop') ?? undefined
    const state = signOAuthState({ productId, provider, shop })
    const url = buildAuthorizeUrl({ productId, provider, shop, state })
    return Response.redirect(url, 302)
  } catch (error) {
    return failToOutcomes(
      productId,
      error instanceof Error ? error.message : 'Could not start OAuth.',
    )
  }
}
