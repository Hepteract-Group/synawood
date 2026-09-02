import Link from 'next/link'
import type { Metadata } from 'next'
import { MarketingSiteFooter } from '@/components/marketing/MarketingSiteFooter'
import { PRODUCT_NAME } from '@/lib/product-name'

export const metadata: Metadata = {
  title: 'Terms of service',
  description: `Draft terms of service for ${PRODUCT_NAME}.`,
}

const TermsPage = () => (
  <div className="mkt-page mkt-legal-page">
    <a href="#mkt-main" className="skip-link">
      Skip to terms
    </a>
    <header className="mkt-pricing-top">
      <Link href="/" className="mkt-pricing-brand">
        {PRODUCT_NAME}
      </Link>
      <Link href="/pricing" className="mkt-pricing-signin">
        Pricing
      </Link>
    </header>
    <main id="mkt-main" className="mkt-legal-main">
      <p className="mkt-legal-draft" role="status">
        Draft — not counsel-approved. Do not treat this as legal advice.
      </p>
      <h1>Terms of service</h1>
      <p>
        {PRODUCT_NAME} is software for planning and producing marketing creative. By creating an
        account you agree to use the service lawfully, keep your login safe, and pay for billed
        usage when your organisation moves off the trial.
      </p>
      <p>
        Prepaid wallet balances and plan entitlements are described on{' '}
        <Link href="/pricing">Pricing</Link>. Generation spend is confirmed before paid jobs run. We
        may suspend generation when payment fails.
      </p>
      <p>
        These terms are a short holding policy for product launch. A counsel-reviewed version will
        replace this draft. Questions: contact the account owner who invited you.
      </p>
    </main>
    <MarketingSiteFooter />
  </div>
)

export default TermsPage
