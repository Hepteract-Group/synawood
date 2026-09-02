import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0052_reframe_role.sql'),
  'utf8',
)

describe('generation_jobs reframe role (#888)', () => {
  it('extends role check to include reframe', () => {
    expect(sql).toMatch(/generation_jobs_role_check/i)
    expect(sql).toMatch(/'reframe'/)
    expect(sql).toMatch(/'speech_enhance'/)
  })
})
