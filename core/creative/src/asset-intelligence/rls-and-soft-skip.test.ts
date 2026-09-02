/** #177 — migration RLS contract + soft-skip helper. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  isPaidIndexSoftSkip,
  PAID_INDEX_SOFT_SKIP_MESSAGE,
  PAID_INDEX_SOFT_SKIP_PREFIX,
} from './soft-skip'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0020_asset_intelligence.sql'),
  'utf8',
)

const rpcSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0022_match_asset_embeddings.sql'),
  'utf8',
)
const shotRpcSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0028_match_shot_embeddings.sql'),
  'utf8',
)

const TABLES = ['asset_index_state', 'asset_shots', 'asset_tags', 'asset_embeddings'] as const

const analyzeSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0040_asset_analyses.sql'),
  'utf8',
)

describe('asset intelligence RLS (#177)', () => {
  it('enables RLS on all index tables with service_role grants only', () => {
    for (const table of TABLES) {
      expect(migrationSql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
      )
      expect(migrationSql).toMatch(
        new RegExp(
          `grant select, insert, update, delete on public\\.${table} to service_role`,
          'i',
        ),
      )
      expect(migrationSql).not.toMatch(
        new RegExp(`grant\\s+[^;]*on public\\.${table} to (authenticated|anon)`, 'i'),
      )
      expect(migrationSql).not.toMatch(new RegExp(`create policy[\\s\\S]*${table}`, 'i'))
    }
  })

  it('keeps match_asset_embeddings callable by service_role only', () => {
    expect(rpcSql).toMatch(
      /grant execute on function[\s\S]*match_asset_embeddings[\s\S]*service_role/i,
    )
    expect(rpcSql).not.toMatch(
      /grant execute on function[\s\S]*match_asset_embeddings[\s\S]*to (authenticated|anon)/i,
    )
  })

  it('keeps match_shot_embeddings callable by service_role only', () => {
    expect(shotRpcSql).toMatch(
      /grant execute on function[\s\S]*match_shot_embeddings[\s\S]*service_role/i,
    )
    expect(shotRpcSql).not.toMatch(
      /grant execute on function[\s\S]*match_shot_embeddings[\s\S]*to (authenticated|anon)/i,
    )
    expect(shotRpcSql).toMatch(/e\.shot_id is not null/)
    expect(shotRpcSql).toMatch(/vector\(1536\)/)
  })

  it('enables RLS on asset_analyses with service_role grants only (#585)', () => {
    expect(analyzeSql).toMatch(/alter table public\.asset_analyses enable row level security/i)
    expect(analyzeSql).toMatch(
      /grant select, insert, update, delete on public\.asset_analyses to service_role/i,
    )
    expect(analyzeSql).not.toMatch(
      /grant\s+[^;]*on public\.asset_analyses to (authenticated|anon)/i,
    )
    expect(analyzeSql).not.toMatch(/create policy[\s\S]*asset_analyses/i)
    expect(analyzeSql).toMatch(/unique \(asset_id, kind, schema_id\)/)
  })
})

describe('paid index soft-skip (#177)', () => {
  it('detects the soft-skip marker used when caps skip caption and visual embed', () => {
    expect(isPaidIndexSoftSkip(PAID_INDEX_SOFT_SKIP_MESSAGE)).toBe(true)
    expect(isPaidIndexSoftSkip(`${PAID_INDEX_SOFT_SKIP_PREFIX} — anything`)).toBe(true)
    expect(isPaidIndexSoftSkip('caption failed: boom')).toBe(false)
    expect(isPaidIndexSoftSkip(null)).toBe(false)
  })
})
