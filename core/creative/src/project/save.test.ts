import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from './schema'
import { RevisionConflictError, saveProject } from './save'

vi.mock('./history', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./history')>()
  return {
    ...actual,
    recordForwardRevision: vi.fn(async () => undefined),
  }
})

const projectId = '22222222-2222-4222-8222-222222222222'
const branchId = '33333333-3333-4333-8333-333333333333'
const project = createEmptyProject({
  id: projectId,
  productId: 'demo',
})

const branchRow = {
  id: branchId,
  project_id: projectId,
  name: 'main',
  slug: 'main',
  is_main: true,
  parent_branch_id: null,
  forked_from_revision: null,
  project_json: project,
  revision: project.revision,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const projectRow = {
  id: projectId,
  product_id: 'demo',
  composition_id: project.compositionId,
  status: project.status,
  model_profile_id: 'mock',
  project_json: project,
  revision: project.revision,
  active_branch_id: branchId,
  history_tip: project.revision,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

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
    builder.maybeSingle = vi.fn(next)
    builder.single = vi.fn(next)
    return builder
  })
  return { from }
}

describe('saveProject optimistic revision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws RevisionConflictError when expected revision does not match', async () => {
    const supabase = queueClient({
      studio_projects: [
        async () => ({
          data: { ...projectRow, revision: 3, project_json: { ...project, revision: 3 } },
          error: null,
        }),
      ],
      studio_project_branches: [
        async () => ({
          data: { ...branchRow, revision: 3, project_json: { ...project, revision: 3 } },
          error: null,
        }),
      ],
    })

    await expect(saveProject(supabase as never, project, 1)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof RevisionConflictError &&
        /revision conflict/i.test(error.message) &&
        error.expected === 1 &&
        error.actual === 3,
    )
  })

  it('dual-writes active branch tip and project mirror on success', async () => {
    const nextRev = project.revision + 1
    const nextProject = { ...project, name: 'Renamed', revision: nextRev }
    const updatedBranch = {
      ...branchRow,
      project_json: nextProject,
      revision: nextRev,
    }
    const updatedRow = {
      ...projectRow,
      project_json: nextProject,
      revision: nextRev,
      history_tip: nextRev,
    }

    const branchUpdates: unknown[] = []
    const projectUpdates: unknown[] = []

    const from = vi.fn((table: string) => {
      const builder: Record<string, unknown> = {}
      const self = () => builder
      builder.select = vi.fn(self)
      builder.eq = vi.fn(self)
      builder.update = vi.fn((payload: unknown) => {
        if (table === 'studio_project_branches') branchUpdates.push(payload)
        if (table === 'studio_projects') projectUpdates.push(payload)
        return builder
      })
      builder.maybeSingle = vi.fn(async () => {
        if (table === 'studio_projects' && projectUpdates.length === 0) {
          return { data: projectRow, error: null }
        }
        if (table === 'studio_project_branches' && branchUpdates.length === 0) {
          return { data: branchRow, error: null }
        }
        if (table === 'studio_project_branches') {
          return { data: updatedBranch, error: null }
        }
        if (table === 'studio_projects') {
          return { data: updatedRow, error: null }
        }
        throw new Error(`Unexpected maybeSingle on ${table}`)
      })
      builder.single = builder.maybeSingle
      return builder
    })

    const saved = await saveProject(
      { from } as never,
      { ...project, name: 'Renamed' },
      project.revision,
    )
    expect(saved.project.revision).toBe(nextRev)
    expect(saved.project.name).toBe('Renamed')
    expect(branchUpdates).toHaveLength(1)
    expect((branchUpdates[0] as { revision: number }).revision).toBe(nextRev)
    expect(projectUpdates.some((p) => (p as { revision?: number }).revision === nextRev)).toBe(true)
  })
})
