import { NextResponse } from 'next/server'
import { archiveVoiceProfile } from '@synawood/creative/voice'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const DELETE = async (
  _request: Request,
  context: { params: Promise<{ productId: string; profileId: string }> },
) => {
  try {
    const { productId, profileId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    await archiveVoiceProfile(access.supabase, { productId, profileId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not archive voice profile.')
  }
}
