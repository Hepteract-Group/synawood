import Link from 'next/link'
import type { Metadata } from 'next'
import { MarketingSiteFooter } from '@/components/marketing/MarketingSiteFooter'
import { PRODUCT_NAME } from '@/lib/product-name'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `Draft privacy policy for ${PRODUCT_NAME}.`,
}

const PrivacyPage = () => (
  <div className="mkt-page mkt-legal-page">
    <a href="#mkt-main" className="skip-link">
      Skip to privacy
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
      <h1>Privacy policy</h1>
      <p>
        We collect account email, organisation membership, product brand assets you upload, Studio
        project data, and billing records needed to run {PRODUCT_NAME}. We use that data to operate
        the product, bill prepaid usage, and improve reliability.
      </p>
      <p>
        We do not sell personal data. Processors (hosting, auth, storage, payment) receive only what
        they need to provide their service. Retention follows active organisation use and legal
        obligations.
      </p>
      <p>
        This page is a short holding policy. A counsel-reviewed privacy notice will replace this
        draft. Contact your organisation owner for access or deletion requests in the meantime.
      </p>
    </main>
    <MarketingSiteFooter />
  </div>
)

export default PrivacyPage
