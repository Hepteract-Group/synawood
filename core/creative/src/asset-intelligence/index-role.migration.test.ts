import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0021_generation_jobs_index_role.sql'),
  'utf8',
)

describe('generation_jobs index role (#164)', () => {
  it('extends role check to include index', () => {
    expect(migrationSql).toMatch(/generation_jobs_role_check/i)
    expect(migrationSql).toMatch(/'index'/)
    expect(migrationSql).toMatch(/'extract'/)
  })
})
