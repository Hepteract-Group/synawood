import { NextResponse } from 'next/server'
import { z } from 'zod'
import { API_KEY_OWNER_ONLY_COPY } from '@/lib/api-console-copy'
import { createProductApiKey, listProductApiKeys } from '@/lib/product-api-keys'
import { ProductAccessError } from '@/lib/product-membership'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({ name: z.string().min(1).max(80) }).strict()

type RouteContext = { params: Promise<{ productId: string }> }

export const GET = async (_request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const keys = await listProductApiKeys(access.supabase, productId)
    return NextResponse.json({
      keys,
      canManage: access.membership.role === 'owner',
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load API keys.')
  }
}

export const POST = async (request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    if (access.membership.role !== 'owner') {
      throw new ProductAccessError(API_KEY_OWNER_ONLY_COPY, 403)
    }
    const body = createSchema.parse(await request.json())
    const created = await createProductApiKey({
      supabase: access.supabase,
      productId,
      createdBy: access.userId,
      name: body.name,
    })
    return NextResponse.json(created)
  } catch (error) {
    return handleRouteError(error, 'Could not create API key.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
