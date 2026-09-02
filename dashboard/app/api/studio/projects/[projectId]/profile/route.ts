import {
  canonicalizeVideoModelId,
  getModelProfile,
  isAllowlistedReasonerModelId,
  isAllowlistedVideoModelId,
  isVideoOffModelId,
} from '@synawood/creative/model-profiles'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = (await request.json().catch(() => ({}))) as {
      profileId?: string
      reasonerModelId?: string | null
      videoModelId?: string | null
    }

    if (!body.profileId && body.reasonerModelId === undefined && body.videoModelId === undefined) {
      return jsonError('profileId, reasonerModelId, or videoModelId is required')
    }

    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase } = access
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.profileId) {
      const profile = getModelProfile(body.profileId)
      patch.model_profile_id = profile.id
    }

    if (body.reasonerModelId !== undefined) {
      if (body.reasonerModelId === null || body.reasonerModelId === '') {
        patch.reasoner_model_id = null
      } else if (!isAllowlistedReasonerModelId(body.reasonerModelId)) {
        return jsonError(`Unknown reasoner model: ${body.reasonerModelId}`, 400)
      } else {
        patch.reasoner_model_id = body.reasonerModelId
      }
    }

    if (body.videoModelId !== undefined) {
      if (
        body.videoModelId === null ||
        body.videoModelId === '' ||
        isVideoOffModelId(body.videoModelId)
      ) {
        patch.video_model_id = null
      } else if (!isAllowlistedVideoModelId(body.videoModelId)) {
        return jsonError(`Unknown video model: ${body.videoModelId}`, 400)
      } else {
        patch.video_model_id = canonicalizeVideoModelId(body.videoModelId)
      }
    }

    const { data, error } = await supabase
      .from('studio_projects')
      .update(patch)
      .eq('id', projectId)
      .select('model_profile_id, reasoner_model_id, video_model_id')
      .single()

    if (error) {
      return jsonError(`Failed to set profile: ${error.message}`, 500)
    }

    const profile = getModelProfile(data.model_profile_id)
    return Response.json({
      modelProfileId: profile.id,
      reasonerModelId: data.reasoner_model_id ?? null,
      videoModelId: data.video_model_id ?? null,
      label: profile.label,
      enabledTools: profile.enabledTools,
      limits: profile.limits,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to set profile', (error) => {
      const message = error instanceof Error ? error.message : 'Failed to set profile'
      return jsonError(message, 400)
    })
  }
}
