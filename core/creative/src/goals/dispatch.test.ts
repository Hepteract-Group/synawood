import { describe, expect, it, vi } from 'vitest'
import { dispatchCampaignAction } from './dispatch'
import { buildCampaignRetrospective } from './retrospective'

describe('dispatchCampaignAction', () => {
  it('runs approved noop_verify to done', async () => {
    const actionId = '11111111-1111-4111-8111-111111111111'
    const goalId = '22222222-2222-4222-8222-222222222222'
    const planId = '33333333-3333-4333-8333-333333333333'
    const actionRow = {
      id: actionId,
      plan_id: planId,
      goal_id: goalId,
      product_id: 'demo',
      action_type: 'noop_verify',
      title: 'Verify',
      payload: {},
      sort_order: 0,
      status: 'approved',
      requires_approval: false,
      error_message: null,
      result: null,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
      approved_at: null,
      approved_by: null,
      started_at: null,
      finished_at: null,
    }

    const updateCalls: unknown[] = []
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaign_actions') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { ...actionRow }, error: null }),
                }),
              }),
            }),
            update: (patch: Record<string, unknown>) => {
              updateCalls.push(patch)
              const chain = {
                eq: () => chain,
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        ...actionRow,
                        status: 'done',
                        result: { verified: true },
                        finished_at: '2026-08-01T00:00:01.000Z',
                      },
                      error: null,
                    }),
                }),
                then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
              }
              return chain
            },
          }
        }
        if (table === 'campaign_goals') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }),
              }),
            }),
          }
        }
        if (table === 'campaign_plans') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { status: 'draft' }, error: null }),
              }),
            }),
          }
        }
        if (table === 'campaign_action_events') {
          return { insert: () => Promise.resolve({ error: null }) }
        }
        throw new Error(`unexpected ${table}`)
      }),
    }

    const result = await dispatchCampaignAction(supabase as never, {
      productId: 'demo',
      actionId,
    })
    expect(result.status).toBe('done')
    expect(updateCalls.length).toBeGreaterThan(0)
  })
})

describe('buildCampaignRetrospective', () => {
  it('returns insight for empty plans', async () => {
    const goalId = '11111111-1111-4111-8111-111111111111'
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
                        title: 'Grow',
                        outcome: '',
                        success_metric: '',
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
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        throw new Error(table)
      }),
    }
    const retro = await buildCampaignRetrospective(supabase as never, {
      productId: 'demo',
      goalId,
    })
    expect(retro.insight).toMatch(/plan_campaign/)
  })
})
