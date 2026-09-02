import { describe, expect, it, vi } from 'vitest'
import { planCampaignForGoal } from './plan-campaign'

describe('planCampaignForGoal', () => {
  it('creates a draft plan with gated actions', async () => {
    const goalId = '11111111-1111-4111-8111-111111111111'
    const planId = '22222222-2222-4222-8222-222222222222'
    let actionInserts = 0
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaign_goals') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: goalId,
                        product_id: 'demo',
                        title: 'Ship Finals',
                        outcome: '',
                        success_metric: '3 Finals',
                        status: 'active',
                        created_by: null,
                        created_at: '2026-08-01T00:00:00.000Z',
                        updated_at: '2026-08-01T00:00:00.000Z',
                        paused_at: null,
                        killed_at: null,
                        completed_at: null,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          }
        }
        if (table === 'campaign_plans') {
          return {
            insert: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: planId,
                      goal_id: goalId,
                      product_id: 'demo',
                      title: 'Plan for Ship Finals',
                      summary: 'Human-gated steps toward: 3 Finals',
                      status: 'draft',
                      created_at: '2026-08-01T00:00:00.000Z',
                      updated_at: '2026-08-01T00:00:00.000Z',
                      paused_at: null,
                      killed_at: null,
                    },
                    error: null,
                  }),
              }),
            }),
          }
        }
        if (table === 'campaign_actions') {
          return {
            insert: (row: { action_type: string; title: string }) => ({
              select: () => ({
                single: () => {
                  actionInserts += 1
                  return Promise.resolve({
                    data: {
                      id: `33333333-3333-4333-8333-${String(actionInserts).padStart(12, '0')}`,
                      plan_id: planId,
                      goal_id: goalId,
                      product_id: 'demo',
                      action_type: row.action_type,
                      title: row.title,
                      payload: {},
                      sort_order: actionInserts,
                      status: row.action_type === 'noop_verify' ? 'approved' : 'awaiting_approval',
                      requires_approval: row.action_type !== 'noop_verify',
                      error_message: null,
                      result: null,
                      created_at: '2026-08-01T00:00:00.000Z',
                      updated_at: '2026-08-01T00:00:00.000Z',
                      approved_at: null,
                      approved_by: null,
                      started_at: null,
                      finished_at: null,
                    },
                    error: null,
                  })
                },
              }),
            }),
          }
        }
        throw new Error(`unexpected ${table}`)
      }),
    }

    const result = await planCampaignForGoal(supabase as never, {
      productId: 'demo',
      goalId,
    })
    expect(result.plan.id).toBe(planId)
    expect(result.actions.length).toBeGreaterThanOrEqual(3)
    expect(result.actions.some((action) => action.actionType === 'noop_verify')).toBe(true)
  })
})
