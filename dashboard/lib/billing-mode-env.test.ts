import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(process.cwd(), '..')

describe('BILLING_MODE env names (#1037)', () => {
  it('names off|on in both example files with skip-wallet copy', () => {
    const local = readFileSync(join(root, '.env.example'), 'utf8')
    const hosted = readFileSync(join(root, '.env.production.example'), 'utf8')
    expect(local).toMatch(/BILLING_MODE=off\|on/)
    expect(hosted).toMatch(/BILLING_MODE=off\|on/)
    expect(local).toMatch(/off = skip wallet \(local\)/)
    expect(local).toMatch(/on = hosted wallet gates/)
    expect(hosted).toMatch(/off = skip wallet \(local\)/)
    expect(hosted).toMatch(/on = hosted wallet gates/)
    expect(local).not.toMatch(/sk_live_|rk_live_/)
    expect(hosted).not.toMatch(/sk_live_|rk_live_/)
  })
})

describe('Stripe env names (#1057)', () => {
  it('documents the four Stripe vars and stripe listen forward URL', () => {
    const local = readFileSync(join(root, '.env.example'), 'utf8')
    const hosted = readFileSync(join(root, '.env.production.example'), 'utf8')
    for (const name of [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_STUDIO_MONTHLY',
      'STRIPE_PRICE_TEAM_MONTHLY',
    ]) {
      expect(local).toContain(name)
      expect(hosted).toContain(name)
    }
    expect(local).toContain('stripe listen --forward-to localhost:3000/api/stripe/webhook')
    expect(hosted).toContain('stripe listen --forward-to localhost:3000/api/stripe/webhook')
    expect(local).not.toMatch(/sk_live_[A-Za-z0-9]+/)
    expect(hosted).not.toMatch(/sk_live_[A-Za-z0-9]+/)
  })
})
