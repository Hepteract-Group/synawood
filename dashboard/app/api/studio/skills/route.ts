import { listFirstPartySkillCatalog } from '@synawood/creative/agent/skills/select'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** First-party Studio skills for Settings catalog (#955). Instructions only. */
export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    await requireStudioAccess({ productId, minRole: 'viewer' })
    const skills = await listFirstPartySkillCatalog(productId)
    return Response.json({
      skills: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        markdown: skill.markdown,
        source: 'first-party' as const,
        alwaysOn: true,
        locked: skill.locked,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to list first-party skills')
  }
}
