import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../project/schema'
import {
  draftGenerationPlan,
  estimateGenerationPlanCostGbp,
  GENERATION_PLAN_NOT_NEEDED,
  isPaidGenerateAvailable,
  updateGenerationPlan,
} from './mutate'

const baseProject = () =>
  createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })

const sampleScene = {
  id: 'gp_hook',
  role: 'hook',
  description: 'Open on the product screen.',
  durationSeconds: 4,
  dialogue: 'Still juggling PDFs by hand?',
}

describe('draftGenerationPlan', () => {
  it('drafts a plan onto project revision with dialogue scenes', () => {
    const project = {
      ...baseProject(),
      intent: {
        keywords: [],
        goal: 'signup' as const,
        goalNote: 'Drive signups',
        lengthSeconds: 30,
        platform: 'tiktok' as const,
      },
    }
    const result = draftGenerationPlan(
      project,
      { scenes: [sampleScene], tone: 'trustworthy' },
      { profileId: 'ci-stub' },
    )
    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.plan.status).toBe('draft')
    expect(result.plan.goal).toBe('Drive signups')
    expect(result.plan.platform).toBe('tiktok')
    expect(result.plan.scenes[0]?.dialogue).toBe('Still juggling PDFs by hand?')
    expect(result.plan.projectRevision).toBe(1)
    expect(result.plan.costEstimateGbp).toBeGreaterThanOrEqual(0)
    expect(result.plan.reasonerModelId).toBe('mock-reasoner')
  })

  it('no-ops with a clear reason when video and image gen are off (founder-edit)', () => {
    const result = draftGenerationPlan(
      baseProject(),
      { scenes: [sampleScene] },
      { profileId: 'founder-edit' },
    )
    expect(result).toEqual({ kind: 'noop', reason: GENERATION_PLAN_NOT_NEEDED })
    expect(isPaidGenerateAvailable('founder-edit')).toBe(false)
  })

  it('no-ops when both generate tools are disabled in Settings', () => {
    const result = draftGenerationPlan(
      baseProject(),
      { scenes: [sampleScene] },
      {
        profileId: 'balanced',
        disabledOptional: ['generate_video_clip', 'generate_image'],
      },
    )
    expect(result).toEqual({ kind: 'noop', reason: GENERATION_PLAN_NOT_NEEDED })
  })
})

describe('updateGenerationPlan', () => {
  it('patches an existing draft plan', () => {
    const draft = draftGenerationPlan(
      baseProject(),
      { scenes: [sampleScene], tone: 'calm' },
      { profileId: 'ci-stub' },
    )
    expect(draft.kind).toBe('plan')
    if (draft.kind !== 'plan') return

    const project = {
      ...baseProject(),
      generationPlan: draft.plan,
      revision: 2,
    }
    const updated = updateGenerationPlan(
      project,
      {
        planId: draft.plan.id,
        tone: 'bold',
        status: 'ready',
      },
      { profileId: 'ci-stub' },
    )
    expect(updated.kind).toBe('plan')
    if (updated.kind !== 'plan') return
    expect(updated.plan.tone).toBe('bold')
    expect(updated.plan.status).toBe('ready')
    expect(updated.plan.projectRevision).toBe(2)
    expect(updated.plan.scenes).toEqual(draft.plan.scenes)
  })

  it('fails when no plan exists', () => {
    const result = updateGenerationPlan(
      baseProject(),
      { planId: '44444444-4444-4444-8444-444444444444', tone: 'bold' },
      { profileId: 'ci-stub' },
    )
    expect(result).toEqual({
      kind: 'error',
      error: 'No Generation Plan on this project. Call draft_generation_plan first.',
    })
  })

  it('no-ops when paid generate is unavailable', () => {
    const plan = {
      id: '44444444-4444-4444-8444-444444444444',
      status: 'draft' as const,
      scenes: [sampleScene],
      costEstimateGbp: 0,
      projectRevision: 1,
      reExtractThisTurn: false,
    }
    const result = updateGenerationPlan(
      { ...baseProject(), generationPlan: plan },
      { planId: plan.id, tone: 'bold' },
      { profileId: 'founder-edit' },
    )
    expect(result).toEqual({ kind: 'noop', reason: GENERATION_PLAN_NOT_NEEDED })
  })

  it('fails on plan id mismatch', () => {
    const plan = {
      id: '44444444-4444-4444-8444-444444444444',
      status: 'draft' as const,
      scenes: [sampleScene],
      costEstimateGbp: 0,
      projectRevision: 1,
      reExtractThisTurn: false,
    }
    const result = updateGenerationPlan(
      { ...baseProject(), generationPlan: plan },
      { planId: '55555555-5555-5555-8555-555555555555', tone: 'bold' },
      { profileId: 'ci-stub' },
    )
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.error).toMatch(/Plan id mismatch/)
    }
  })

  it('fails when the plan was already applied', () => {
    const plan = {
      id: '44444444-4444-4444-8444-444444444444',
      status: 'applied' as const,
      scenes: [sampleScene],
      costEstimateGbp: 0,
      projectRevision: 1,
      reExtractThisTurn: false,
    }
    const result = updateGenerationPlan(
      { ...baseProject(), generationPlan: plan },
      { planId: plan.id, tone: 'bold' },
      { profileId: 'ci-stub' },
    )
    expect(result).toEqual({
      kind: 'error',
      error: 'Cannot update an applied Generation Plan.',
    })
  })

  it('marks the plan stale when project revision moved', () => {
    const plan = {
      id: '44444444-4444-4444-8444-444444444444',
      status: 'ready' as const,
      scenes: [sampleScene],
      costEstimateGbp: 0,
      projectRevision: 1,
      reExtractThisTurn: false,
    }
    const result = updateGenerationPlan(
      { ...baseProject(), revision: 3, generationPlan: plan },
      { planId: plan.id, tone: 'bold' },
      { profileId: 'ci-stub' },
    )
    expect(result.kind).toBe('plan')
    if (result.kind === 'plan') {
      expect(result.plan.status).toBe('stale')
      expect(result.plan.projectRevision).toBe(3)
    }
  })
})

describe('estimateGenerationPlanCostGbp', () => {
  it('estimates video cost per scene duration on ci-stub (zero)', () => {
    expect(
      estimateGenerationPlanCostGbp({
        scenes: [{ id: 'a', description: 'Beat', durationSeconds: 4 }],
        videoModelId: 'mock-video',
        videoEnabled: true,
        imageEnabled: false,
      }),
    ).toBe(0)
  })

  it('falls back to image units when video is off', () => {
    const cost = estimateGenerationPlanCostGbp({
      scenes: [
        { id: 'a', description: 'Still A' },
        { id: 'b', description: 'Still B' },
      ],
      imageModelId: 'mock-image',
      videoEnabled: false,
      imageEnabled: true,
    })
    expect(cost).toBe(0)
  })

  it('sums non-zero video cost for live models', () => {
    const cost = estimateGenerationPlanCostGbp({
      scenes: [{ id: 'a', description: 'Beat', durationSeconds: 4 }],
      videoModelId: 'google/veo-3.1-fast-generate-001',
      videoEnabled: true,
      imageEnabled: false,
    })
    expect(cost).toBe(1.6)
  })
})
