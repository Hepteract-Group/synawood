import { NextResponse } from 'next/server'
import { handleRouteError } from '../../../../lib/studio-server'
import { healthResponseSchema } from '../../../../lib/v1-health'
import { withApiKey } from '../../../../lib/with-api-key'

/** Smoke for #275 — proves withApiKey without exposing Studio Tools. */
export const GET = async (request: Request) => {
  try {
    const access = await withApiKey(request)
    return NextResponse.json(
      healthResponseSchema.parse({ ok: true as const, productId: access.productId }),
    )
  } catch (error) {
    return handleRouteError(error, 'Invalid API key.')
  }
}
