import { describe, expect, it, vi } from 'vitest'
import { brollPlanSchema } from './schema'
import { loadBrollPlan, loadLatestDraftBrollPlan, saveBrollPlan } from './persist'

describe('broll plan persist (#518)', () => {
  it('round-trips the same plan id', async () => {
    const plan = brollPlanSchema.parse({
      id: '44444444-4444-4444-8444-444444444444',
      createdAt: '2026-08-17T12:00:00.000Z',
      projectRevision: 1,
      sceneIds: ['sc_hook'],
      rows: [],
      estimatedGbp: 0,
      status: 'draft',
      rationale: 'test',
    })
    const stored: Record<string, unknown>[] = []
    const supabase = {
      from: vi.fn(() => ({
        upsert: (row: Record<string, unknown>) => {
          stored.splice(0, stored.length, row)
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          }
        },
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: stored[0] ?? null, error: null }),
          }),
        }),
      })),
    }
    const saved = await saveBrollPlan(supabase as never, {
      productId: 'demo',
      projectId: '22222222-2222-4222-8222-222222222222',
      inputHash: 'abc',
      plan,
    })
    expect(saved.plan.id).toBe(plan.id)
    const loaded = await loadBrollPlan(supabase as never, plan.id)
    expect(loaded?.plan.id).toBe(plan.id)
  })

  it('loads the latest draft for reload chrome', async () => {
    const plan = brollPlanSchema.parse({
      id: '55555555-5555-4555-8555-555555555555',
      createdAt: '2026-08-20T12:00:00.000Z',
      projectRevision: 2,
      sceneIds: [],
      rows: [],
      estimatedGbp: 0,
      status: 'draft',
      rationale: 'cached',
    })
    const row = { id: plan.id, plan_json: plan, status: 'draft' }
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: row, error: null }),
                }),
              }),
            }),
          }),
        }),
      })),
    }
    const loaded = await loadLatestDraftBrollPlan(
      supabase as never,
      '22222222-2222-4222-8222-222222222222',
    )
    expect(loaded?.plan.id).toBe(plan.id)
  })
})
