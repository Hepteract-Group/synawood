import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  disconnectIntegration,
  insertManualOutcome,
  listCreativePerformance,
  listIntegrations,
  listOutcomes,
  listUnattributed,
  oauthStatusForProviders,
  outcomeInputSchema,
  pullOneProvider,
  runPerformancePullForProduct,
  upsertIntegrationSecret,
  markIntegrationPull,
} from '@synawood/creative/performance'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const tokenSchema = z
  .object({
    action: z.literal('token'),
    provider: z.enum(['tiktok', 'meta', 'youtube', 'linkedin', 'shopify', 'stripe']),
    token: z.string().min(8).max(4000),
  })
  .strict()

const pullSchema = z
  .object({
    action: z.literal('pull'),
    provider: z.enum(['tiktok', 'meta', 'youtube', 'linkedin', 'shopify', 'stripe']),
  })
  .strict()

const pullAllSchema = z.object({ action: z.literal('pull-all') }).strict()

const disconnectSchema = z
  .object({
    action: z.literal('disconnect'),
    provider: z.enum(['tiktok', 'meta', 'youtube', 'linkedin', 'shopify', 'stripe']),
  })
  .strict()

const postSchema = z.union([
  outcomeInputSchema,
  tokenSchema,
  pullSchema,
  pullAllSchema,
  disconnectSchema,
])

export const GET = async (
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const [integrations, outcomes, unattributed] = await Promise.all([
      listIntegrations(access.supabase, productId),
      listOutcomes(access.supabase, productId),
      listUnattributed(access.supabase, productId),
    ])
    let performance: Awaited<ReturnType<typeof listCreativePerformance>> = []
    let performanceUnavailable = false
    try {
      performance = await listCreativePerformance(access.supabase, productId)
    } catch {
      performanceUnavailable = true
    }
    return NextResponse.json({
      integrations,
      outcomes,
      performance,
      unattributed,
      performanceUnavailable,
      oauthConfigured: oauthStatusForProviders(),
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load outcomes.')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const body = postSchema.parse(await request.json())
    if ('action' in body && body.action === 'token') {
      await upsertIntegrationSecret(access.supabase, {
        productId,
        provider: body.provider,
        token: body.token,
      })
      return NextResponse.json({ ok: true })
    }
    if ('action' in body && body.action === 'disconnect') {
      await disconnectIntegration(access.supabase, {
        productId,
        provider: body.provider,
      })
      return NextResponse.json({ ok: true })
    }
    if ('action' in body && body.action === 'pull-all') {
      const results = await runPerformancePullForProduct({
        supabase: access.supabase,
        productId,
      })
      return NextResponse.json({ ok: true, results })
    }
    if ('action' in body && body.action === 'pull') {
      const integrations = await listIntegrations(access.supabase, productId)
      const row = integrations.find((item) => item.provider === body.provider)
      const connected = row?.status === 'connected'
      const result = pullOneProvider({ provider: body.provider, connected: Boolean(connected) })
      if (row) {
        await markIntegrationPull(access.supabase, {
          integrationId: row.id,
          reason: result.reason,
          rowCount: Array.isArray(result.rows) ? result.rows.length : 0,
        })
      }
      return NextResponse.json(result)
    }
    const result = await insertManualOutcome(access.supabase, productId, body)
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, 'Could not save outcome.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
