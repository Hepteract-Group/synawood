/** Propose a default plan + gated actions for a goal (#301). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { campaignActionTypeSchema, type CampaignActionType } from './schema'
import { createCampaignAction, createCampaignPlan, getCampaignGoal } from './store'

const defaultActionsForGoal = (
  title: string,
): Array<{
  actionType: CampaignActionType
  title: string
  payload: Record<string, unknown>
}> => [
  {
    actionType: 'draft_brief',
    title: `Draft brief for “${title}”`,
    payload: { source: 'plan_campaign' },
  },
  {
    actionType: 'create_campaign_pack',
    title: 'Create campaign pack project',
    payload: { compositionId: 'campaign-pack-still' },
  },
  {
    actionType: 'open_studio_project',
    title: 'Open Studio for review',
    payload: {},
  },
  {
    actionType: 'noop_verify',
    title: 'Verify goal wiring (no side effects)',
    payload: { note: 'Safe smoke action for localhost' },
  },
]

export const planCampaignForGoal = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    goalId: string
    planTitle?: string
    planSummary?: string
  },
) => {
  const goal = await getCampaignGoal(supabase, {
    productId: input.productId,
    goalId: input.goalId,
  })
  if (!goal) throw new Error(`Unknown goal ${input.goalId}`)
  if (goal.status === 'killed' || goal.status === 'paused') {
    throw new Error(`Goal is ${goal.status}; resume before planning`)
  }

  const plan = await createCampaignPlan(supabase, {
    goalId: goal.id,
    productId: input.productId,
    title: input.planTitle?.trim() || `Plan for ${goal.title}`,
    summary:
      input.planSummary?.trim() ||
      `Human-gated steps toward: ${goal.successMetric || goal.outcome || goal.title}`,
    status: 'draft',
  })

  const actions = []
  let sortOrder = 0
  for (const step of defaultActionsForGoal(goal.title)) {
    campaignActionTypeSchema.parse(step.actionType)
    actions.push(
      await createCampaignAction(supabase, {
        planId: plan.id,
        goalId: goal.id,
        productId: input.productId,
        actionType: step.actionType,
        title: step.title,
        payload: step.payload,
        sortOrder: sortOrder++,
        requiresApproval: step.actionType !== 'noop_verify',
        status: step.actionType === 'noop_verify' ? 'approved' : 'awaiting_approval',
      }),
    )
  }

  return { goal, plan, actions }
}
