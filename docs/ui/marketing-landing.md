# Marketing landing (UI)

Public first surface for Synawood (Plan 07 / #102). Not the operator dashboard.

## Intent

One calm marketing composition that explains the product and captures **waitlist** interest. Sign-in is available but secondary. Open self-serve signup for everyone is **not** the v1 hero.

## First viewport (required)

One composition only:

1. **Brand** — Synawood (hero-level, not a nav-only whisper)
2. **Headline** — one line
3. **Supporting sentence** — one short line
4. **CTA group** — primary **Join the waitlist**; secondary **Sign in** (ghost / quiet)
5. **Dominant visual** — full-bleed or edge-to-edge atmosphere (product/atmosphere imagery; not a card collage)

Do **not** put in the first viewport: stats strips, feature grids, pricing, schedules, or multiple competing CTAs.

Follow [principles.md](./principles.md) and the repo frontend design rules (no purple-on-white cliché, no Inter-default stack, no card-wrapped hero). Under 900px the hero is one column: copy and waitlist first, visual second — do not put the mock above the CTA.

## Waitlist

- Inline email field + submit in the CTA group, or a single step that stays on-brand
- Success: thank-you state on the same page (no fake “check your inbox for a magic dashboard link”)
- Persist email server-side (`waitlist` table or equivalent); no Auth user created

## Auth entry

- **Sign in** → `/login`
- Signup is reachable from login (“Create account”) but still **allowlist-gated** (ADR-0024). Prefer not promoting signup in the landing hero while waitlist is the public path.
- **Pricing** (`/pricing`) is a footer / secondary link, not the first viewport. Catalog must match [ADR-0082](../adr/0082-hosted-billing-wallet-entitlements.md) (no “unlimited”). Spec: [billing.md](./billing.md).

## Tokens

Share color/type tokens with `/login` and `/signup` so the auth pages feel like the same site. Operator shell (`/(app)`) may keep its denser console tokens ([dashboard-shell.md](./dashboard-shell.md)).

## Copy

- Follow `docs/ui/copy-standards.md` when that doc exists; until then: no em dashes, human voice, no “revolutionize your workflow” sludge
- Use **Product** when referring to what customers create after access — not Organization

## Acceptance checklist (#102)

- [ ] First viewport = brand + headline + support + CTA + one visual
- [ ] Waitlist is the obvious public action
- [ ] Sign in is secondary
- [ ] Auth pages match landing tokens
- [ ] Non-allowlisted signup cannot create an account
