import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { STUDIO_TOOL_NAMES } from './studio-tools'
import { createStudioTools } from './studio-tools'
import type { StudioToolContext } from './types'

const toolCallOptions = { toolCallId: '1', messages: [] } as never

const makeCtx = (profileId = 'ci-stub'): StudioToolContext => {
  const project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  return {
    productId: 'demo',
    projectId: project.id,
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
    modelProfileId: profileId,
    persist: false,
    toolTrace: [],
  }
}

describe('generation plan tools (#1063)', () => {
  it('registers draft_generation_plan and update_generation_plan on the first-party catalog', () => {
    expect(STUDIO_TOOL_NAMES).toContain('draft_generation_plan')
    expect(STUDIO_TOOL_NAMES).toContain('update_generation_plan')
  })

  it('draft_generation_plan mutates project.generationPlan', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)
    const outcome = (await tools.draft_generation_plan.execute!(
      {
        goal: 'Drive signups',
        tone: 'trustworthy',
        scenes: [
          {
            id: 'gp_hook',
            role: 'hook',
            description: 'Open on the product screen.',
            dialogue: 'Still juggling PDFs by hand?',
          },
        ],
      },
      toolCallOptions,
    )) as { ok: boolean; data?: { planId?: string; mutated?: boolean } }

    expect(outcome.ok).toBe(true)
    expect(outcome.data?.mutated).toBe(true)
    expect(ctx.project.generationPlan?.goal).toBe('Drive signups')
    expect(ctx.project.generationPlan?.scenes[0]?.dialogue).toBe('Still juggling PDFs by hand?')
    expect(outcome.data?.planId).toBe(ctx.project.generationPlan?.id)
  })

  it('update_generation_plan patches the mirrored plan', async () => {
    const ctx = makeCtx()
    const tools = createStudioTools(ctx)

    const drafted = (await tools.draft_generation_plan.execute!(
      {
        scenes: [{ id: 'gp_hook', description: 'Hook beat' }],
      },
      toolCallOptions,
    )) as { ok: true; data?: { planId?: string } }
    const planId = drafted.data?.planId
    expect(planId).toBeTruthy()

    const updated = (await tools.update_generation_plan.execute!(
      { planId: planId!, tone: 'bold', status: 'ready' },
      toolCallOptions,
    )) as { ok: boolean; data?: { mutated?: boolean } }

    expect(updated.ok).toBe(true)
    expect(updated.data?.mutated).toBe(true)
    expect(ctx.project.generationPlan?.tone).toBe('bold')
    expect(ctx.project.generationPlan?.status).toBe('ready')
  })

  it('no-ops when video and image generation are off', async () => {
    const ctx = makeCtx('founder-edit')
    const tools = createStudioTools(ctx)
    const before = JSON.stringify(ctx.project)

    const outcome = (await tools.draft_generation_plan.execute!(
      {
        scenes: [{ id: 'gp_hook', description: 'Hook beat' }],
      },
      toolCallOptions,
    )) as { ok: boolean; data?: { noop?: boolean; mutated?: boolean }; summary?: string }

    expect(outcome.ok).toBe(true)
    expect(outcome.data?.noop).toBe(true)
    expect(outcome.data?.mutated).toBe(false)
    expect(ctx.project.generationPlan).toBeUndefined()
    expect(JSON.stringify(ctx.project)).toBe(before)
    expect(outcome.summary).toMatch(/not required/i)
  })
})
