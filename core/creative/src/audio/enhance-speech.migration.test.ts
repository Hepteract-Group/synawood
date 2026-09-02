import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0051_speech_enhance_role.sql'),
  'utf8',
)

describe('generation_jobs speech_enhance role (#882)', () => {
  it('extends role check to include speech_enhance', () => {
    expect(migrationSql).toMatch(/generation_jobs_role_check/i)
    expect(migrationSql).toMatch(/'speech_enhance'/)
    expect(migrationSql).toMatch(/'voice_lipsync'/)
  })
})
