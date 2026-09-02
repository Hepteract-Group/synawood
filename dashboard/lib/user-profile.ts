import type { SupabaseClient } from '@supabase/supabase-js'

export const PROFILE_JOBS = ['founder', 'marketer', 'editor', 'other'] as const
export const PROFILE_INTENTS = ['make_ads', 'run_gtm', 'exploring'] as const

export type ProfileJob = (typeof PROFILE_JOBS)[number]
export type ProfileIntent = (typeof PROFILE_INTENTS)[number]

export type ProfileWrite = {
  displayName: string | null
  jobTitle: ProfileJob | null
  intent: ProfileIntent | null
  skipped: boolean
}

const asTrimmed = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed.slice(0, 80)
}

const asJob = (value: unknown): ProfileJob | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') {
    throw new Error('Pick one of the listed roles.')
  }
  if ((PROFILE_JOBS as readonly string[]).includes(value)) return value as ProfileJob
  throw new Error('Pick one of the listed roles.')
}

const asIntent = (value: unknown): ProfileIntent | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') {
    throw new Error('Pick one of the listed goals.')
  }
  if ((PROFILE_INTENTS as readonly string[]).includes(value)) return value as ProfileIntent
  throw new Error('Pick one of the listed goals.')
}

/** Maps a PATCH body to columns. Skip and empty Continue both complete onboarding. */
export const parseProfilePatch = (body: unknown): ProfileWrite => {
  if (!body || typeof body !== 'object') {
    throw new Error('Send a JSON body.')
  }
  const record = body as Record<string, unknown>
  const displayName = asTrimmed(record.displayName)
  const jobTitle = asJob(record.jobTitle)
  const intent = asIntent(record.intent)
  const skipped = record.skip === true || (!displayName && !jobTitle && !intent)
  return { displayName, jobTitle, intent, skipped }
}

export const isUserProfileComplete = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('onboarding_completed_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`)
  }
  return Boolean(data?.onboarding_completed_at)
}

export const isProfileExemptPath = (pathname: string): boolean => {
  if (pathname === '/onboarding/profile' || pathname.startsWith('/onboarding/profile/')) return true
  if (pathname === '/api/me/profile' || pathname.startsWith('/api/me/profile/')) return true
  if (pathname === '/api/me/session' || pathname.startsWith('/api/me/session/')) return true
  if (pathname === '/api/me/guides' || pathname.startsWith('/api/me/guides/')) return true
  if (pathname === '/invite' || pathname.startsWith('/invite/')) return true
  if (pathname === '/api/invites' || pathname.startsWith('/api/invites/')) return true
  if (pathname.startsWith('/auth/callback')) return true
  if (pathname === '/login' || pathname === '/signup' || pathname === '/access-denied') return true
  return false
}
