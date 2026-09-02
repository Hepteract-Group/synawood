import { WaitlistForm } from '@/components/marketing/WaitlistForm'
import { MarketingSiteFooter } from '@/components/marketing/MarketingSiteFooter'
import { PRODUCT_NAME } from '@/lib/product-name'

const MarketingLandingPage = () => (
  <div className="mkt-page">
    <a href="#mkt-main" className="skip-link">
      Skip to content
    </a>
    <div className="mkt-hero" aria-label={PRODUCT_NAME}>
      <div id="mkt-main" className="mkt-hero-copy">
        <p className="mkt-brand">{PRODUCT_NAME}</p>
        <h1 className="mkt-headline">Ship weekly video ads without hiring an editor</h1>
        <p className="mkt-support">
          Chat turns into a timeline you can approve. Built for founders who need Final assets on a
          schedule, not another CapCut tab.
        </p>
        <WaitlistForm />
      </div>
      <div className="mkt-hero-visual" aria-hidden>
        <div className="mkt-studio-mock">
          <div className="mkt-studio-mock-bar">
            <span />
            <span />
            <span />
          </div>
          <div className="mkt-studio-mock-body">
            <div className="mkt-studio-mock-chat">
              <p>Add a 15s hook, then cut to product still.</p>
              <p className="is-agent">Placed hook clip · added still on V1</p>
            </div>
            <div className="mkt-studio-mock-timeline">
              <div className="mkt-clip is-hook" />
              <div className="mkt-clip is-still" />
              <div className="mkt-clip is-cta" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <MarketingSiteFooter />
  </div>
)

export default MarketingLandingPage
