import { NextResponse } from 'next/server'
import { AuthRequiredError, requireUser } from '../../../../lib/require-user'
import { getStudioClients, handleRouteError, jsonError } from '../../../../lib/studio-server'
import { parseProfilePatch } from '../../../../lib/user-profile'

const rowToJson = (
  row: {
    display_name: string | null
    job_title: string | null
    intent: string | null
    onboarding_completed_at: string | null
    onboarding_skipped: boolean
  } | null,
) => ({
  displayName: row?.display_name ?? null,
  jobTitle: row?.job_title ?? null,
  intent: row?.intent ?? null,
  onboardingCompleted: Boolean(row?.onboarding_completed_at),
  skipped: row?.onboarding_skipped ?? false,
})

export const GET = async () => {
  try {
    const user = await requireUser()
    const { supabase } = getStudioClients()
    const { data, error } = await supabase
      .from('user_profiles')
      .select('display_name, job_title, intent, onboarding_completed_at, onboarding_skipped')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      throw new Error(error.message)
    }
    return NextResponse.json(rowToJson(data))
  } catch (error) {
    return handleRouteError(error, 'Could not load your profile.')
  }
}

export const PATCH = async (request: Request) => {
  try {
    const user = await requireUser()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError('Send a JSON body.', 400)
    }

    let parsed
    try {
      parsed = parseProfilePatch(body)
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : 'Could not save.', 400)
    }

    const { supabase } = getStudioClients()
    const now = new Date().toISOString()
    const payload: {
      user_id: string
      onboarding_completed_at: string
      onboarding_skipped: boolean
      display_name?: string | null
      job_title?: string | null
      intent?: string | null
    } = parsed.skipped
      ? {
          user_id: user.id,
          onboarding_completed_at: now,
          onboarding_skipped: true,
        }
      : {
          user_id: user.id,
          display_name: parsed.displayName,
          job_title: parsed.jobTitle,
          intent: parsed.intent,
          onboarding_completed_at: now,
          onboarding_skipped: false,
        }
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('display_name, job_title, intent, onboarding_completed_at, onboarding_skipped')
      .single()
    if (error) {
      throw new Error(error.message)
    }
    return NextResponse.json(rowToJson(data))
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return handleRouteError(error, 'Sign in to continue.')
    }
    return handleRouteError(error, 'Could not save your profile.')
  }
}
