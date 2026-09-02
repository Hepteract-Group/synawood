import { importSkillFromSkillsSh } from '@synawood/creative/packs/from-skills-sh'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Fetch SKILL.md from skills.sh / GitHub and install as an ADR-0039 pack (#956). */
export const POST = async (request: Request) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      productId?: string
      source?: string
      scope?: 'product' | 'account'
    } | null
    const productId = body?.productId?.trim()
    const source = body?.source?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (!source) return jsonError('Paste owner/repo or a skills.sh URL', 400)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const result = await importSkillFromSkillsSh({
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      productId,
      userId: access.userId,
      source,
      scope: body?.scope === 'account' ? 'account' : 'product',
    })
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to import skill from skills.sh')
  }
}
