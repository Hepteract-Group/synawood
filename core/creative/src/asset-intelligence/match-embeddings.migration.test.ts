import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0022_match_asset_embeddings.sql'),
  'utf8',
)

describe('match_asset_embeddings RPC (#168)', () => {
  it('defines cosine match RPC for service_role', () => {
    expect(migrationSql).toMatch(/match_asset_embeddings/i)
    expect(migrationSql).toMatch(/vector\(1536\)/)
    expect(migrationSql).toMatch(/service_role/)
    expect(migrationSql).toMatch(/<=>/)
    expect(migrationSql).toMatch(/shot_id is null/)
  })
})

describe('match_shot_embeddings RPC (#515)', () => {
  it('pins 1536-d shot rows and does not replace whole-asset match', () => {
    const shotSql = readFileSync(
      path.join(process.cwd(), '../../supabase/migrations/0028_match_shot_embeddings.sql'),
      'utf8',
    )
    expect(shotSql).toMatch(/match_shot_embeddings/i)
    expect(shotSql).toMatch(/vector\(1536\)/)
    expect(shotSql).toMatch(/shot_id is not null/)
    expect(shotSql).toMatch(/transcript_segments/)
    expect(shotSql).toMatch(/p_kind text default 'text'/)
    expect(shotSql).toMatch(/e\.kind = p_kind/)
    expect(migrationSql).toMatch(/shot_id is null/)
  })
})
