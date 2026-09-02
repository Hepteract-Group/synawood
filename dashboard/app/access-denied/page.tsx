import Link from 'next/link'
import { PRODUCT_MARK, PRODUCT_NAME } from '../../lib/product-name'

export default function AccessDeniedPage() {
  return (
    <div className="auth-shell">
      <Link href="/" className="auth-brand">
        <span className="auth-brand-mark" aria-hidden>
          {PRODUCT_MARK}
        </span>
        <span>{PRODUCT_NAME}</span>
      </Link>
      <section className="auth-panel" aria-labelledby="denied-title">
        <h1 id="denied-title">You do not have access yet</h1>
        <p className="auth-lede">
          {PRODUCT_NAME} is invite-only right now. Join the waitlist, or ask a Product owner for an
          invite link.
        </p>
        <p className="auth-foot">
          <Link href="/">Join the waitlist</Link>
          {' · '}
          <Link href="/login">Sign in</Link>
        </p>
      </section>
    </div>
  )
}
