import { NextResponse } from 'next/server'
import { GUIDE_CATALOGUE } from '../../../../../lib/guides/catalogue'
import {
  canTransitionGuideStatus,
  parseGuideProgressWrite,
} from '../../../../../lib/guides/progress'
import { requireUser } from '../../../../../lib/require-user'
import { getStudioClients, handleRouteError, jsonError } from '../../../../../lib/studio-server'

type RouteContext = { params: Promise<{ guideId: string }> }

export const PUT = async (request: Request, context: RouteContext) => {
  try {
    const user = await requireUser()
    const { guideId } = await context.params
    if (!GUIDE_CATALOGUE.some((guide) => guide.id === guideId)) {
      return jsonError('That guide is not in this app.', 404)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError('Send a JSON body.', 400)
    }

    let parsed
    try {
      parsed = parseGuideProgressWrite(body)
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : 'Could not save.', 400)
    }

    const { supabase } = getStudioClients()
    const { data: current, error: loadError } = await supabase
      .from('user_guide_progress')
      .select('status')
      .eq('user_id', user.id)
      .eq('guide_id', guideId)
      .maybeSingle()
    if (loadError) {
      throw new Error(loadError.message)
    }
    if (!canTransitionGuideStatus(current?.status, parsed.status)) {
      return jsonError('That guide is already finished. Replay it from Settings.', 409)
    }

    const { data, error } = await supabase
      .from('user_guide_progress')
      .upsert(
        {
          user_id: user.id,
          guide_id: guideId,
          status: parsed.status,
          step_index: parsed.stepIndex,
        },
        { onConflict: 'user_id,guide_id' },
      )
      .select('guide_id, status, step_index')
      .single()
    if (error) {
      throw new Error(error.message)
    }
    return NextResponse.json({
      guideId: data.guide_id,
      status: data.status,
      stepIndex: data.step_index,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not save guide progress.')
  }
}
