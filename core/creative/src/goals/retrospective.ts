/** Lightweight retrospective insight hook (#307). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { listCampaignActionsForPlan, listCampaignPlansForGoal } from './store'
import { getCampaignGoal } from './store'

export type CampaignRetrospective = {
  goalId: string
  title: string
  status: string
  totals: {
    plans: number
    actions: number
    done: number
    failed: number
    killed: number
    awaitingApproval: number
  }
  insight: string
}

export const buildCampaignRetrospective = async (
  supabase: SupabaseClient,
  input: { productId: string; goalId: string },
): Promise<CampaignRetrospective> => {
  const goal = await getCampaignGoal(supabase, input)
  if (!goal) throw new Error(`Unknown goal ${input.goalId}`)
  const plans = await listCampaignPlansForGoal(supabase, input)
  let actions = 0
  let done = 0
  let failed = 0
  let killed = 0
  let awaitingApproval = 0
  for (const plan of plans) {
    const rows = await listCampaignActionsForPlan(supabase, {
      productId: input.productId,
      planId: plan.id,
    })
    actions += rows.length
    for (const row of rows) {
      if (row.status === 'done') done += 1
      if (row.status === 'failed') failed += 1
      if (row.status === 'killed') killed += 1
      if (row.status === 'awaiting_approval' || row.status === 'proposed') awaitingApproval += 1
    }
  }

  let insight = 'No actions yet — run plan_campaign to propose a gated plan.'
  if (actions > 0 && done === actions) {
    insight = 'All actions completed. Review Finals/Campaigns outputs against the success metric.'
  } else if (failed > 0) {
    insight = `${failed} action(s) failed — inspect errors before approving more spend-adjacent work.`
  } else if (killed > 0 && goal.status === 'killed') {
    insight = 'Goal was killed; remaining gated work was cancelled.'
  } else if (awaitingApproval > 0) {
    insight = `${awaitingApproval} action(s) await human approval before dispatch.`
  } else if (done > 0) {
    insight = `${done}/${actions} actions done. Continue approving the next gated step.`
  }

  return {
    goalId: goal.id,
    title: goal.title,
    status: goal.status,
    totals: {
      plans: plans.length,
      actions,
      done,
      failed,
      killed,
      awaitingApproval,
    },
    insight,
  }
}
