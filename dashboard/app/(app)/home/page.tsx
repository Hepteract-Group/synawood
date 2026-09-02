import Link from 'next/link'
import { GeneratorSpendDashboard } from '@/components/dashboard/GeneratorSpendDashboard'

const FUNNEL_STAGES = [
  { id: 'visit', label: 'Visit', hint: 'Landing or campaign click' },
  { id: 'activate', label: 'Activate', hint: 'Core job finished' },
  { id: 'account', label: 'Account', hint: 'Signed up' },
  { id: 'trial', label: 'Trial', hint: 'Paid trial started' },
  { id: 'paid', label: 'Paid', hint: 'Converted' },
] as const

const SHORTCUTS = [
  {
    href: '/studio',
    mark: 'S',
    title: 'Studio',
    blurb: 'Chat a cut into shape, preview, then export.',
  },
  {
    href: '/products',
    mark: 'P',
    title: 'Products',
    blurb: 'Switch brand context or create a new Product.',
  },
  {
    href: '/content',
    mark: 'W',
    title: 'Work board',
    blurb: 'See the week’s drafts and posting slots.',
  },
  {
    href: '/usage',
    mark: 'U',
    title: 'Usage',
    blurb: 'Tool traces and spend detail for sessions.',
  },
  {
    href: '/insights',
    mark: 'I',
    title: 'Insights',
    blurb: 'Review proposals from Final rollup. Apply writes local priors.',
  },
] as const

const HomePage = () => (
  <section className="panel home-page mos-enter">
    <header className="home-header">
      <div className="home-header-copy">
        <p className="eyebrow">Home</p>
        <h1 className="home-title">Dashboard</h1>
        <p className="page-lede">
          Funnel first: visit to paid. Studio sits beside that, it does not replace it.
        </p>
      </div>
      <div className="home-header-actions">
        <Link href="/studio" className="btn btn-primary">
          Open Studio
        </Link>
        <Link href="/products" className="btn btn-ghost">
          Products
        </Link>
      </div>
    </header>

    <section className="funnel-strip" aria-labelledby="funnel-heading">
      <div className="funnel-strip-copy">
        <h2 id="funnel-heading" className="funnel-strip-title">
          Weekly funnel
        </h2>
        <p className="muted">
          Counts are not wired from GA4 / tool analytics yet. This strip is honest about the empty
          state instead of hiding it.
        </p>
      </div>
      <ol className="funnel-stages">
        {FUNNEL_STAGES.map((stage) => (
          <li key={stage.id} className="funnel-stage">
            <span className="funnel-stage-value tabular-nums" aria-label={`${stage.label} count`}>
              —
            </span>
            <strong className="funnel-stage-label">{stage.label}</strong>
            <span className="muted funnel-stage-hint">{stage.hint}</span>
          </li>
        ))}
      </ol>
    </section>

    <ul className="home-shortcuts mos-stagger">
      {SHORTCUTS.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="home-shortcut-card">
            <span className="home-shortcut-mark" aria-hidden>
              {item.mark}
            </span>
            <span className="home-shortcut-body">
              <strong className="home-shortcut-title">{item.title}</strong>
              <span className="home-shortcut-blurb">{item.blurb}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>

    <GeneratorSpendDashboard />
  </section>
)

export default HomePage
