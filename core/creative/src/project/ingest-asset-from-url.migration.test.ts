import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0023_asset_source_url.sql'),
  'utf8',
)

describe('asset source url migration (#108)', () => {
  it('extends assets.source check to include url', () => {
    expect(migrationSql).toContain("'url'")
    expect(migrationSql).toContain('assets_source_check')
  })
})
