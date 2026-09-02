import { NextResponse } from 'next/server'
import { PLAN_LABEL, resolveProductPlan, rolesIncludedOnPlan } from '../../../lib/plan-flags'
import { requireUser } from '../../../lib/require-user'
import { handleRouteError } from '../../../lib/studio-server'

/** Current plan flags for job-function upsell chips. No billing. */
export const GET = async () => {
  try {
    await requireUser()
    const plan = resolveProductPlan(process.env.SYNAWOOD_PRODUCT_PLAN)
    return NextResponse.json({
      plan,
      label: PLAN_LABEL[plan],
      includedRoles: rolesIncludedOnPlan(plan),
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load plan flags.')
  }
}
