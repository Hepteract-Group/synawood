import { parseExtractedBrief } from '@synawood/creative/brief'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const patchBodySchema = z
  .object({
    brief: z.unknown(),
  })
  .strict()

export const PATCH = async (
  request: Request,
  context: { params: Promise<{ projectId: string; briefId: string }> },
) => {
  try {
    const { projectId, briefId } = await context.params
    const body = patchBodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const brief = parseExtractedBrief(body.brief)

    const { data: existing, error: loadError } = await access.supabase
      .from('extracted_briefs')
      .select('id, status, project_id')
      .eq('id', briefId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (loadError) {
      return jsonError(`Failed to load brief: ${loadError.message}`, 500)
    }
    if (!existing) {
      return jsonError('Brief not found for this project', 404)
    }
    if (existing.status !== 'ready' && existing.status !== 'applied') {
      return jsonError('Only ready briefs can be edited', 409)
    }

    const nextJson = { ...brief, id: briefId }
    const { data, error } = await access.supabase
      .from('extracted_briefs')
      .update({
        brief_json: nextJson,
        updated_at: new Date().toISOString(),
      })
      .eq('id', briefId)
      .eq('project_id', projectId)
      .select('id, brief_json, status')
      .single()

    if (error) {
      return jsonError(`Failed to save brief: ${error.message}`, 500)
    }

    return Response.json({
      briefId: data.id as string,
      brief: data.brief_json,
      status: data.status,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to update brief', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      if (err instanceof Error && /Zod|invalid|parse/i.test(err.message)) {
        return jsonError(err.message, 400)
      }
      return null
    })
  }
}
