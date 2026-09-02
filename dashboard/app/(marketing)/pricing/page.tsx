import Link from 'next/link'
import type { Metadata } from 'next'
import { HOSTED_PLANS, type HostedPlanId } from '@synawood/creative/billing/plans'
import { PricingColumns } from '@/components/marketing/PricingColumns'
import { MarketingSiteFooter } from '@/components/marketing/MarketingSiteFooter'
import { PRODUCT_NAME } from '@/lib/product-name'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Team plans. Prepaid credits in pounds. No unlimited video.',
}

const ORDER: HostedPlanId[] = ['trial', 'studio', 'team']

const PricingPage = () => (
  <div className="mkt-page mkt-pricing-page">
    <a href="#mkt-main" className="skip-link">
      Skip to pricing
    </a>
    <header className="mkt-pricing-top">
      <Link href="/" className="mkt-pricing-brand">
        {PRODUCT_NAME}
      </Link>
      <Link href="/signup" className="mkt-pricing-signin">
        Start trial
      </Link>
    </header>
    <main id="mkt-main" className="mkt-pricing-main">
      <h1 className="mkt-pricing-title">Pricing</h1>
      <p className="mkt-pricing-sub">Team plans. Prepaid credits in pounds. No unlimited video.</p>
      <PricingColumns plans={ORDER.map((id) => HOSTED_PLANS[id])} highlightId="studio" />
    </main>
    <MarketingSiteFooter />
  </div>
)

export default PricingPage
