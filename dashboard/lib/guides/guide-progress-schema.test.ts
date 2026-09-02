import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(process.cwd(), '../supabase/migrations/0050_user_guide_progress.sql'),
  'utf8',
)

describe('user_guide_progress migration (#863)', () => {
  it('stores per-user progress, not the tour copy', () => {
    expect(sql).toContain('create table public.user_guide_progress')
    expect(sql).toContain('primary key (user_id, guide_id)')
    expect(sql).toMatch(/pending.*in_progress.*completed.*dismissed/)
    expect(sql).toMatch(/user_id = auth\.uid\(\)/)
    expect(sql).toMatch(
      /grant select, insert, update on public\.user_guide_progress to authenticated/,
    )
  })
})
