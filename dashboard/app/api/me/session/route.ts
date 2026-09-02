import { NextResponse } from 'next/server'
import { GUIDE_CATALOGUE } from '../../../../lib/guides/catalogue'
import { readGuideForceId, selectEligibleGuides } from '../../../../lib/guides/eligibility'
import { requireUser } from '../../../../lib/require-user'
import { getStudioClients, handleRouteError } from '../../../../lib/studio-server'

export const POST = async () => {
  try {
    const user = await requireUser()
    const { supabase } = getStudioClients()
    const now = new Date().toISOString()

    const { data: existing, error: loadError } = await supabase
      .from('user_profiles')
      .select('last_login_at, onboarding_completed_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (loadError) {
      throw new Error(loadError.message)
    }

    const previousLoginAt = existing?.last_login_at ?? null
    const { error: upsertError } = await supabase.from('user_profiles').upsert(
      {
        user_id: user.id,
        last_login_at: now,
      },
      { onConflict: 'user_id' },
    )
    if (upsertError) {
      throw new Error(upsertError.message)
    }

    const { data: memberships, error: memberError } = await supabase
      .from('product_members')
      .select('role')
      .eq('user_id', user.id)
    if (memberError) {
      throw new Error(memberError.message)
    }

    const { data: progressRows, error: progressError } = await supabase
      .from('user_guide_progress')
      .select('guide_id, status, step_index')
      .eq('user_id', user.id)
    if (progressError) {
      throw new Error(progressError.message)
    }

    const eligible = selectEligibleGuides({
      now: new Date(now),
      previousLoginAt,
      userCreatedAt: user.created_at,
      memberships: (memberships ?? []).map((row) => ({ role: String(row.role) })),
      progress: (progressRows ?? []).map((row) => ({
        guideId: String(row.guide_id),
        status: String(row.status),
      })),
      catalogue: GUIDE_CATALOGUE,
      forceId: readGuideForceId({
        GUIDE_FORCE_ID: process.env.GUIDE_FORCE_ID,
        VERCEL_ENV: process.env.VERCEL_ENV,
      }),
    })

    return NextResponse.json({
      previousLoginAt,
      onboardingCompleted: Boolean(existing?.onboarding_completed_at),
      eligibleGuides: eligible.map((guide) => {
        const row = (progressRows ?? []).find((item) => String(item.guide_id) === guide.id)
        return {
          id: guide.id,
          kind: guide.kind,
          title: guide.title,
          summary: guide.summary,
          steps: guide.steps,
          status: row ? String(row.status) : 'pending',
          stepIndex: row ? Number(row.step_index ?? 0) : 0,
        }
      }),
    })
  } catch (error) {
    return handleRouteError(error, 'Could not start your session.')
  }
}
