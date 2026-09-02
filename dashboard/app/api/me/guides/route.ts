import { NextResponse } from 'next/server'
import { GUIDE_CATALOGUE } from '../../../../lib/guides/catalogue'
import { listGuidesForSettings } from '../../../../lib/guides/presentation'
import { requireUser } from '../../../../lib/require-user'
import { getStudioClients, handleRouteError } from '../../../../lib/studio-server'

export const GET = async () => {
  try {
    const user = await requireUser()
    const { supabase } = getStudioClients()
    const { data, error } = await supabase
      .from('user_guide_progress')
      .select('guide_id, status, step_index')
      .eq('user_id', user.id)
    if (error) {
      throw new Error(error.message)
    }
    return NextResponse.json({
      guides: listGuidesForSettings(
        GUIDE_CATALOGUE,
        (data ?? []).map((row) => ({
          guideId: String(row.guide_id),
          status: String(row.status),
          stepIndex: Number(row.step_index ?? 0),
        })),
      ),
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load guides.')
  }
}
