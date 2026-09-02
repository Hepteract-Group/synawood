import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from './schema'
import {
  BRANCH_EXISTS_PREFIX,
  createBranchFromActiveTip,
  isBranchExistsError,
  mergeBranchTip,
  promoteBranchToMain,
  replaceBranchTip,
  summarizeBranchRow,
  switchActiveBranch,
} from './branch-ops'
import type { StudioProjectBranchRow } from './branches'
import type { StudioProjectRow } from './load'
import { RevisionConflictError } from './revision-conflict'

const projectId = '22222222-2222-4222-8222-222222222222'
const mainId = '33333333-3333-4333-8333-333333333333'
const funnyId = '44444444-4444-4444-8444-444444444444'
const empty = createEmptyProject({ id: projectId, productId: 'demo' })

const projectRow = (overrides?: Partial<StudioProjectRow>): StudioProjectRow => ({
  id: projectId,
  product_id: 'demo',
  composition_id: 'talking-head-60',
  status: 'drafting',
  model_profile_id: 'mock',
  project_json: empty,
  revision: empty.revision,
  active_branch_id: mainId,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const branchRow = (overrides?: Partial<StudioProjectBranchRow>): StudioProjectBranchRow => ({
  id: mainId,
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
    builder.insert = vi.fn(self)
    builder.eq = vi.fn(self)
    builder.order = vi.fn(self)
    builder.maybeSingle = vi.fn(next)
    builder.single = vi.fn(next)
    return builder
  })
  return { from }
}

describe('branch-ops (#183)', () => {
  it('summarizeBranchRow marks the active tip', () => {
    expect(summarizeBranchRow(branchRow(), mainId).isActive).toBe(true)
    expect(summarizeBranchRow(branchRow(), funnyId).isActive).toBe(false)
  })

  it('createBranchFromActiveTip inserts a Funny fork off main', async () => {
    const main = branchRow()
    const row = projectRow()
    const funny = branchRow({
      id: funnyId,
      name: 'Funny',
      slug: 'funny',
      is_main: false,
      parent_branch_id: mainId,
      forked_from_revision: empty.revision,
    })
    const supabase = queueClient({
      studio_projects: [async () => ({ data: row, error: null })],
      studio_project_branches: [
        async () => ({ data: main, error: null }),
        async () => ({ data: null, error: null }),
        async () => ({ data: funny, error: null }),
      ],
    })

    const created = await createBranchFromActiveTip(supabase as never, {
      projectId,
      name: 'Funny',
    })
    expect(created.branch.slug).toBe('funny')
    expect(created.forkedFrom.id).toBe(mainId)
  })

  it('switchActiveBranch mirrors the target tip onto the project row', async () => {
    const funnyTip = { ...empty, name: 'Funny cut', revision: 4 }
    const funny = branchRow({
      id: funnyId,
      name: 'Funny',
      slug: 'funny',
      is_main: false,
      project_json: funnyTip,
      revision: 4,
    })
    const row = projectRow({ active_branch_id: mainId })
    const supabase = queueClient({
      studio_projects: [
        async () => ({ data: row, error: null }),
        async () => ({
          data: {
            ...row,
            active_branch_id: funnyId,
            project_json: funnyTip,
            revision: 4,
          },
          error: null,
        }),
      ],
      studio_project_branches: [
        async () => ({ data: branchRow(), error: null }),
        async () => ({ data: funny, error: null }),
      ],
    })

    const switched = await switchActiveBranch(supabase as never, {
      projectId,
      slug: 'funny',
    })
    expect(switched.branch.id).toBe(funnyId)
    expect(switched.project.revision).toBe(4)
    expect(switched.project.name).toBe('Funny cut')
  })

  it('replaceBranchTip full-replaces the target tip and mirrors when active', async () => {
    const funnyJson = { ...empty, name: 'Funny tip', revision: 2 }
    const funny = branchRow({
      id: funnyId,
      name: 'Funny',
      slug: 'funny',
      is_main: false,
      project_json: funnyJson,
      revision: 2,
    })
    const main = branchRow({ revision: 1 })
    const row = projectRow({ active_branch_id: mainId, revision: 1 })
    const nextMain = { ...funnyJson, revision: 2, id: projectId, productId: 'demo' }

    const supabase = queueClient({
      studio_project_branches: [
        async () => ({ data: funny, error: null }),
        async () => ({ data: main, error: null }),
        async () => ({ data: main, error: null }),
        async () => ({
          data: { ...main, project_json: nextMain, revision: 2 },
          error: null,
        }),
      ],
      studio_projects: [
        async () => ({ data: row, error: null }),
        async () => ({
          data: { ...row, project_json: nextMain, revision: 2 },
          error: null,
        }),
      ],
    })

    const replaced = await replaceBranchTip(supabase as never, {
      projectId,
      sourceBranchId: funnyId,
      targetBranchId: mainId,
      expectedTargetRevision: 1,
    })
    expect(replaced.target.revision).toBe(2)
    expect(replaced.project.revision).toBe(2)
  })

  it('promoteBranchToMain full-replaces main from a non-main tip', async () => {
    const funnyJson = { ...empty, name: 'Promote me', revision: 3 }
    const funny = branchRow({
      id: funnyId,
      name: 'Funny',
      slug: 'funny',
      is_main: false,
      project_json: funnyJson,
      revision: 3,
    })
    const main = branchRow({ revision: 1 })
    const row = projectRow({ active_branch_id: mainId, revision: 1 })
    const nextMain = { ...funnyJson, revision: 2, id: projectId, productId: 'demo' }

    const supabase = queueClient({
      studio_project_branches: [
        async () => ({ data: funny, error: null }), // resolve source
        async () => ({ data: main, error: null }), // resolveMainBranch
        async () => ({ data: funny, error: null }), // replace source
        async () => ({ data: main, error: null }), // replace target
        async () => ({ data: main, error: null }), // resolveActive inside replace
        async () => ({
          data: { ...main, project_json: nextMain, revision: 2 },
          error: null,
        }),
      ],
      studio_projects: [
        async () => ({ data: row, error: null }),
        async () => ({
          data: { ...row, project_json: nextMain, revision: 2 },
          error: null,
        }),
      ],
    })

    const promoted = await promoteBranchToMain(supabase as never, {
      projectId,
      sourceSlug: 'funny',
    })
    expect(promoted.source.id).toBe(funnyId)
    expect(promoted.target.is_main).toBe(true)
    expect(promoted.target.revision).toBe(2)
  })

  it('promoteBranchToMain refuses promoting main onto itself', async () => {
    const main = branchRow()
    const supabase = queueClient({
      studio_project_branches: [async () => ({ data: main, error: null })],
    })
    await expect(
      promoteBranchToMain(supabase as never, { projectId, sourceBranchId: mainId }),
    ).rejects.toThrow(/Cannot promote main/)
  })

  it('mergeBranchTip defaults target to main and uses tip revision when omitted', async () => {
    const funnyJson = { ...empty, name: 'Merge me', revision: 5 }
    const funny = branchRow({
      id: funnyId,
      name: 'Funny',
      slug: 'funny',
      is_main: false,
      project_json: funnyJson,
      revision: 5,
    })
    const main = branchRow({ revision: 2 })
    const row = projectRow({ active_branch_id: mainId, revision: 2 })
    const nextMain = { ...funnyJson, revision: 3, id: projectId, productId: 'demo' }

    const supabase = queueClient({
      studio_project_branches: [
        async () => ({ data: funny, error: null }), // source by slug
        async () => ({ data: main, error: null }), // target main by slug
        async () => ({ data: funny, error: null }), // replace source
        async () => ({ data: main, error: null }), // replace target
        async () => ({ data: main, error: null }), // resolveActive
        async () => ({
          data: { ...main, project_json: nextMain, revision: 3 },
          error: null,
        }),
      ],
      studio_projects: [
        async () => ({ data: row, error: null }),
        async () => ({
          data: { ...row, project_json: nextMain, revision: 3 },
          error: null,
        }),
      ],
    })

    const merged = await mergeBranchTip(supabase as never, {
      projectId,
      sourceSlug: 'funny',
    })
    expect(merged.target.slug).toBe('main')
    expect(merged.target.revision).toBe(3)
  })

  it('replaceBranchTip rejects same source and target', async () => {
    await expect(
      replaceBranchTip(queueClient({}) as never, {
        projectId,
        sourceBranchId: mainId,
        targetBranchId: mainId,
        expectedTargetRevision: 1,
      }),
    ).rejects.toThrow(/must differ/)
  })

  it('replaceBranchTip throws RevisionConflictError on stale target revision', async () => {
    const funny = branchRow({
      id: funnyId,
      name: 'Funny',
      slug: 'funny',
      is_main: false,
      revision: 2,
    })
    const main = branchRow({ revision: 5 })
    const supabase = queueClient({
      studio_project_branches: [
        async () => ({ data: funny, error: null }),
        async () => ({ data: main, error: null }),
      ],
    })

    await expect(
      replaceBranchTip(supabase as never, {
        projectId,
        sourceBranchId: funnyId,
        targetBranchId: mainId,
        expectedTargetRevision: 1,
      }),
    ).rejects.toBeInstanceOf(RevisionConflictError)
  })

  it('createBranchFromActiveTip rejects reserved main name', async () => {
    const main = branchRow()
    const row = projectRow()
    const supabase = queueClient({
      studio_projects: [async () => ({ data: row, error: null })],
      studio_project_branches: [async () => ({ data: main, error: null })],
    })
    await expect(
      createBranchFromActiveTip(supabase as never, { projectId, name: 'main' }),
    ).rejects.toThrow(/main/)
  })

  it('isBranchExistsError matches the typed prefix only', () => {
    expect(isBranchExistsError(new Error(`${BRANCH_EXISTS_PREFIX} locale-fr`))).toBe(true)
    expect(isBranchExistsError(new Error('Failed to create branch: unique violation'))).toBe(false)
  })
})
