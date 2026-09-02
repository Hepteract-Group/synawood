export const SUPABASE_REF_MISMATCH = 'Supabase project ref does not match this environment'

/** When EXPECTED_SUPABASE_PROJECT_REF is set, refuse a different configured ref. */
export const assertExpectedSupabaseProjectRef = (
  projectRef: string,
  env: Record<string, string | undefined>,
): void => {
  const expected = env.EXPECTED_SUPABASE_PROJECT_REF?.trim()
  if (!expected) return
  if (expected !== projectRef) {
    throw new Error(SUPABASE_REF_MISMATCH)
  }
}
