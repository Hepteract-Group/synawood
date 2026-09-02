import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(process.cwd(), '../supabase/migrations/0049_user_profiles.sql'),
  'utf8',
)

describe('user_profiles migration (#861)', () => {
  it('creates an own-row profile table with skip completing onboarding', () => {
    expect(sql).toContain('create table public.user_profiles')
    expect(sql).toContain('user_id uuid primary key references auth.users')
    expect(sql).toMatch(/job_title in \('founder', 'marketer', 'editor', 'other'\)/)
    expect(sql).toMatch(/intent in \('make_ads', 'run_gtm', 'exploring'\)/)
    expect(sql).toContain('onboarding_completed_at timestamptz')
    expect(sql).toContain('onboarding_skipped boolean not null default false')
    expect(sql).toMatch(/user_profiles_select_own/)
    expect(sql).toMatch(/user_id = auth\.uid\(\)/)
    expect(sql).toMatch(/grant select, insert, update on public\.user_profiles to authenticated/)
  })
})
