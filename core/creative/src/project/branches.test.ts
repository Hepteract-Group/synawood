import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createEmptyProject } from './schema'
import {
  compactBranchTip,
  isMainBranchSlug,
  MAIN_BRANCH_NAME,
  MAIN_BRANCH_SLUG,
  resolveActiveBranch,
  resolveBranchById,
  resolveBranchBySlug,
  resolveMainBranch,
  slugifyBranchName,
  syncActiveBranchMirror,
  writeActiveBranchTip,
  type StudioProjectBranchRow,
} from './branches'
import type { StudioProjectRow } from './load'

const projectId = '22222222-2222-4222-8222-222222222222'
const branchId = '33333333-3333-4333-8333-333333333333'
const funnyBranchId = '44444444-4444-4444-8444-444444444444'

const empty = createEmptyProject({ id: projectId, productId: 'demo' })

const projectRow = (overrides?: Partial<StudioProjectRow>): StudioProjectRow => ({
  id: projectId,
  product_id: 'demo',
  composition_id: 'talking-head-60',
  status: 'drafting',
  model_profile_id: 'mock',
  project_json: empty,
  revision: empty.revision,
  active_branch_id: branchId,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const branchRow = (overrides?: Partial<StudioProjectBranchRow>): StudioProjectBranchRow => ({
  id: branchId,
  project_id: projectId,
  name: 'main',
  slug: 'main',
  is_main: true,
  parent_branch_id: null,
  forked_from_revision: null,
  project_json: empty,
  revision: empty.revision,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0019_studio_project_branches.sql'),
  'utf8',
)

/** Minimal thenable query builder that resolves maybeSingle / single from a queue. */
const queueClient = (handlers: Record<string, Array<() => Promise<unknown>>>) => {
  const from = vi.fn((table: string) => {
    const queue = handlers[table] ?? []
    const next = () => {
      const fn = queue.shift()
      if (!fn) throw new Error(`Unexpected from(${table})`)
      return fn()
    }
    const builder: Record<string, unknown> = {}
    const self = () => builder
    builder.select = vi.fn(self)
    builder.update = vi.fn(self)
    builder.eq = vi.fn(self)
    builder.order = vi.fn(self)
    builder.maybeSingle = vi.fn(next)
    builder.single = vi.fn(next)
    return builder
  })
  return { from }
}

describe('studio project branches (ADR-0030)', () => {
  it('reserves main name and slug', () => {
    expect(MAIN_BRANCH_NAME).toBe('main')
    expect(MAIN_BRANCH_SLUG).toBe('main')
    expect(isMainBranchSlug('main')).toBe(true)
    expect(isMainBranchSlug('Funny')).toBe(false)
    expect(slugifyBranchName('Funny Mode!')).toBe('funny-mode')
  })

  it('migration backfills main idempotently and enforces one main', () => {
    expect(migrationSql).toContain('create table public.studio_project_branches')
    expect(migrationSql).toContain('active_branch_id')
    expect(migrationSql).toContain('where not exists')
    expect(migrationSql).toContain('studio_project_branches_one_main_per_project_idx')
    expect(migrationSql).toContain("name = 'main' and slug = 'main'")
    expect(migrationSql).not.toContain(
      'grant select on public.studio_project_branches to authenticated',
    )
    expect(migrationSql).toContain('studio_projects_ensure_main_branch')
  })

  it('migration enables RLS and grants only service_role (#189)', () => {
    expect(migrationSql).toMatch(
      /alter table public\.studio_project_branches enable row level security/i,
    )
    expect(migrationSql).toMatch(
      /grant select, insert, update, delete on public\.studio_project_branches to service_role/i,
    )
    expect(migrationSql).not.toMatch(
      /grant\s+[^;]*on public\.studio_project_branches to (authenticated|anon)/i,
    )
    expect(migrationSql).not.toMatch(/create policy[\s\S]*studio_project_branches/i)
  })

  it('compactBranchTip parses a full tip onto the project identity', () => {
    const tip = compactBranchTip(branchRow(), projectRow())
    expect(tip.id).toBe(projectId)
    expect(tip.productId).toBe('demo')
    expect(tip.revision).toBe(empty.revision)
  })

  it('compactBranchTip coerces identity fields from the project row', () => {
    const foreign = createEmptyProject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      productId: 'other',
    })
    const tip = compactBranchTip(
      branchRow({ project_json: { ...foreign, revision: 9 }, revision: 9 }),
      projectRow(),
    )
    expect(tip.id).toBe(projectId)
    expect(tip.productId).toBe('demo')
    expect(tip.revision).toBe(9)
  })

  it('compactBranchTip keeps authored compositionSource on the tip', () => {
    const authored = createEmptyProject({
      id: projectId,
      productId: 'demo',
      compositionId: 'authored',
    })
    const withSource = {
      ...authored,
      compositionSource: {
        source: 'export default () => null',
        motionSeed: 'seed-branch-1',
        compileError: null,
      },
    }
    const tip = compactBranchTip(
      branchRow({ project_json: withSource }),
      projectRow({ composition_id: 'authored' }),
    )
    expect(tip.compositionId).toBe('authored')
    expect(tip.compositionSource?.source).toBe('export default () => null')
    expect(tip.compositionSource?.motionSeed).toBe('seed-branch-1')
  })

  it('resolveBranchBySlug loads by project + slug', async () => {
    const main = branchRow({ slug: 'funny', name: 'Funny', is_main: false })
    const supabase = queueClient({
      studio_project_branches: [async () => ({ data: main, error: null })],
    })
    const row = await resolveBranchBySlug(supabase as never, { projectId, slug: 'Funny' })
    expect(row.name).toBe('Funny')
  })

  it('resolveBranchById loads by id within the project', async () => {
    const funny = branchRow({ id: funnyBranchId, name: 'Funny', slug: 'funny', is_main: false })
    const supabase = queueClient({
      studio_project_branches: [async () => ({ data: funny, error: null })],
    })
    const row = await resolveBranchById(supabase as never, {
      projectId,
      branchId: funnyBranchId,
    })
    expect(row.slug).toBe('funny')
  })

  it('resolveMainBranch loads the is_main tip', async () => {
    const main = branchRow()
    const supabase = queueClient({
      studio_project_branches: [async () => ({ data: main, error: null })],
    })
    const row = await resolveMainBranch(supabase as never, projectId)
    expect(row.is_main).toBe(true)
    expect(row.slug).toBe('main')
  })

  it('resolveActiveBranch falls back to main when active_branch_id is stale', async () => {
    const main = branchRow()
    const supabase = queueClient({
      studio_projects: [
        async () => ({ data: projectRow({ active_branch_id: 'missing' }), error: null }),
      ],
      studio_project_branches: [
        async () => ({ data: null, error: null }),
        async () => ({ data: main, error: null }),
      ],
    })

    const resolved = await resolveActiveBranch(supabase as never, projectId)
    expect(resolved.branch.is_main).toBe(true)
    expect(resolved.project.id).toBe(projectId)
  })

  it('syncActiveBranchMirror writes normalized tip to branch and project row', async () => {
    const main = branchRow()
    const row = projectRow()
    const supabase = queueClient({
      studio_projects: [
        async () => ({ data: row, error: null }),
        async () => ({
          data: { ...row, project_json: empty, revision: empty.revision },
          error: null,
        }),
      ],
      studio_project_branches: [
        async () => ({ data: main, error: null }),
        async () => ({ error: null }),
      ],
    })

    const synced = await syncActiveBranchMirror(supabase as never, projectId)
    expect(synced.project.id).toBe(projectId)
    expect(synced.branch.id).toBe(branchId)
  })

  it('writeActiveBranchTip updates Funny (active) tip, not only the project mirror', async () => {
    const funnyId = '44444444-4444-4444-8444-444444444444'
    const funny = branchRow({
      id: funnyId,
      name: 'Funny',
      slug: 'funny',
      is_main: false,
      revision: empty.revision,
    })
    const row = projectRow({ active_branch_id: funnyId })
    const next = { ...empty, name: 'Edited on Funny', revision: empty.revision + 1 }

    const supabase = queueClient({
      studio_projects: [
        async () => ({ data: row, error: null }),
        async () => ({
          data: {
            ...row,
            project_json: next,
            revision: next.revision,
            history_tip: next.revision,
          },
          error: null,
        }),
      ],
      studio_project_branches: [
        async () => ({ data: funny, error: null }),
        async () => ({
          data: { ...funny, project_json: next, revision: next.revision },
          error: null,
        }),
      ],
    })

    const wrote = await writeActiveBranchTip(supabase as never, {
      projectId,
      next,
      expectedRevision: empty.revision,
      historyTip: next.revision,
    })
    expect(wrote.branch.id).toBe(funnyId)
    expect(wrote.branch.revision).toBe(next.revision)
    expect(wrote.previous.revision).toBe(empty.revision)
  })
})
