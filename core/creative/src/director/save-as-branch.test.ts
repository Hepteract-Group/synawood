import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project/schema'
import type { DirectorPlan } from '../intent/schema'
import type { StudioToolContext } from '../tools/types'
import { commitDirectorPlanInContext, saveDirectorPlanAsBranch } from './save-as-branch'

const projectId = '22222222-2222-4222-8222-222222222222'
const planId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const draftPlan = (revision: number): DirectorPlan => ({
  id: planId,
  createdAt: '2026-01-01T00:00:00.000Z',
  projectRevision: revision,
  status: 'draft',
  scope: 'global',
  style: 'premium',
  rationale: 'Tighten pacing',
  costEstimateGbp: 0,
  generatorCalls: [],
  reasonerModelId: 'mock-reasoner',
  edits: [
    {
      id: 'edit-1',
      status: 'proposed',
      previewText: 'Set hook',
      mutation: { type: 'set_hook_title', text: 'Save as branch hook' },
    },
  ],
})

const makeCtx = (overrides?: Partial<StudioToolContext>): StudioToolContext => {
  const project = {
    ...createEmptyProject({ id: projectId, productId: 'demo' }),
    revision: 2,
    directorPlan: draftPlan(2),
  }
  return {
    productId: 'demo',
    projectId,
    project,
    expectedRevision: project.revision,
    supabase: { from: vi.fn() } as never,
    blobEnv: {
      connectionString: 'x',
      containerName: 'marketing-os',
      useLocalPrefix: true,
      accountName: 'a',
      accountKey: 'k',
    },
    modelProfileId: 'ci-stub',
    persist: false,
    toolTrace: [],
    ...overrides,
  }
}

describe('saveDirectorPlanAsBranch (#184)', () => {
  it('commitDirectorPlanInContext applies edits in-memory', async () => {
    const ctx = makeCtx()
    const result = await commitDirectorPlanInContext(ctx, { planId })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.appliedIds).toEqual(['edit-1'])
    expect(result.plan.status).toBe('applied')
    expect(ctx.project.overlays.some((o) => o.kind === 'hook_title')).toBe(true)
    expect(ctx.project.revision).toBe(3)
  })

  it('commitDirectorPlanInContext fails when plan is stale', async () => {
    const ctx = makeCtx()
    ctx.project = {
      ...ctx.project,
      revision: 9,
      directorPlan: draftPlan(2),
    }
    ctx.expectedRevision = 9
    const result = await commitDirectorPlanInContext(ctx, { planId })
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/stale/i),
    })
  })

  it('saveDirectorPlanAsBranch requires persist', async () => {
    const ctx = makeCtx({ persist: false })
    const result = await saveDirectorPlanAsBranch(ctx, {
      planId,
      branchName: 'Funny',
    })
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringMatching(/persisted/i),
    })
  })
})
