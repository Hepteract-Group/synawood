import Link from 'next/link'

export const MarketingSiteFooter = () => (
  <footer className="mkt-site-footer">
    <nav aria-label="Site">
      <Link href="/pricing">Pricing</Link>
      <Link href="/terms">Terms</Link>
      <Link href="/privacy">Privacy</Link>
      <Link href="/login">Sign in</Link>
    </nav>
  </footer>
)
