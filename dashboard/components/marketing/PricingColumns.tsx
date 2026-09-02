import Link from 'next/link'
import type { HostedPlan, HostedPlanId } from '@synawood/creative/billing/plans'

const PLAN_LABEL: Record<HostedPlanId, string> = {
  trial: 'Trial',
  studio: 'Studio',
  team: 'Team',
}

const priceLine = (plan: HostedPlan): string => {
  if (plan.id === 'trial') return `Free for ${plan.trialDays ?? 14} days`
  return `£${plan.listGbpPerMonth}/mo`
}

const ctaFor = (plan: HostedPlan): { href: string; label: string } => {
  if (plan.id === 'trial') return { href: '/signup', label: 'Start trial' }
  return { href: '/signup', label: `Choose ${PLAN_LABEL[plan.id]}` }
}

export const PricingColumns = ({
  plans,
  highlightId,
}: {
  plans: HostedPlan[]
  highlightId?: HostedPlanId
}) => (
  <ul className="mkt-pricing-grid">
    {plans.map((plan) => {
      const cta = ctaFor(plan)
      const highlighted = plan.id === highlightId
      return (
        <li
          key={plan.id}
          className={highlighted ? 'mkt-pricing-col is-highlight' : 'mkt-pricing-col'}
          aria-current={highlighted ? 'true' : undefined}
        >
          <h2 className="mkt-pricing-col-name">{PLAN_LABEL[plan.id]}</h2>
          <p className="mkt-pricing-col-price">{priceLine(plan)}</p>
          <ul className="mkt-pricing-facts">
            <li>{plan.seatLimit} people</li>
            <li>
              {plan.includedGrantGbp > 0
                ? `~£${plan.includedGrantGbp} credits included`
                : 'No included credits'}
            </li>
            <li>Paid video {plan.paidHostedVideo ? 'on' : 'off'}</li>
            <li>Watermark {plan.watermarkExports ? 'on exports' : 'off'}</li>
          </ul>
          <Link
            href={cta.href}
            className={highlighted ? 'mkt-pricing-cta is-primary' : 'mkt-pricing-cta'}
          >
            {cta.label}
          </Link>
        </li>
      )
    })}
  </ul>
)
