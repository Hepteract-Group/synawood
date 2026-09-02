import { describe, expect, it } from 'vitest'
import {
  campaignActionTypeSchema,
  createCampaignGoalInputSchema,
  mapCampaignGoalRow,
} from './schema'

describe('campaign goals schema', () => {
  it('parses create input defaults', () => {
    const parsed = createCampaignGoalInputSchema.parse({
      productId: 'demo',
      title: 'Ship 3 Finals',
    })
    expect(parsed.outcome).toBe('')
    expect(parsed.successMetric).toBe('')
  })

  it('maps goal rows', () => {
    const goal = mapCampaignGoalRow({
      id: '11111111-1111-4111-8111-111111111111',
      product_id: 'demo',
      title: 'Grow waitlist',
      outcome: 'More signups',
      success_metric: '+50 entries',
      status: 'active',
      created_by: null,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
      paused_at: null,
      killed_at: null,
      completed_at: null,
    })
    expect(goal.productId).toBe('demo')
    expect(goal.title).toBe('Grow waitlist')
  })

  it('allows noop_verify action type for tests', () => {
    expect(campaignActionTypeSchema.parse('noop_verify')).toBe('noop_verify')
  })
})
