# ADR-0067 — Public SaaS identity (login and signup)

**Status:** accepted  
**Date:** 2026-08-23  
**Amends:** [ADR-0024](./0024-product-auth-and-membership.md) §3–4 (waitlist-first *as the only path*; allowlist as the *login gate*)  
**Does not supersede:** ADR-0024 §1–2 (Product remains the tenancy unit; the private example is not the app). [ADR-0037](./0037-functional-roles.md) membership roles.  
**Related:** [ADR-0068](./0068-organization-is-product-tenancy.md), [ADR-0069](./0069-dismissable-product-guides.md)  
**Docs:** [system-design/saas.md](../system-design/saas.md), [architecture/saas-identity.md](../architecture/saas-identity.md), [ux/saas-onboarding.md](../ux/saas-onboarding.md)

## Context

Synawood is usable as a multi-user operator app today: Google and email login, Product create, members, invites ([product-auth.md](../architecture/product-auth.md)). Access is still **allowlisted**. Strangers hit waitlist. That is correct for an in-house console. It is wrong for a SaaS.

SaaS customers expect:

1. Create an account without emailing the founder.
2. Sign in again on any browser and land in *their* team.
3. Invite colleagues from Settings → Members (already built).
4. A short “who are you” step that can be skipped.

Temptations that would hurt:

- Rip out Supabase Auth and rebuild sessions.
- Keep the allowlist as the *customer* gate and call that SaaS.
- Collapse “account” and “membership” so skipping onboarding leaves a broken user.

## Decision

### 1. Identity is a person, not a Product

A **Supabase Auth user** is the account. One person, one email, one user id. Memberships are many (`product_members`). Profile data (`user_profiles`) hangs off the user, never off the Product.

### 2. Signup and login are public product surfaces

`/signup` and `/login` are first-class SaaS pages, not founder-only.

- **Continue with Google** remains primary.
- Email + password remains secondary.
- Magic link is allowed later; not required for this program.
- Session cookies, `/auth/callback`, and PKCE stay as they are.

### 3. Allowlist is an ops valve, not the default customer gate

| Mode | Who may complete signup/login |
|---|---|
| **saas** (default on hosted production once this ships) | Anyone with a valid Auth user. Rate-limit and abuse checks apply. |
| **invite_or_allowlist** (current behaviour) | Allowlisted emails **or** an open Product invite. |
| **allowlist** | Allowlisted emails only. |

`AUTH_ACCESS_MODE=saas \| invite_or_allowlist \| allowlist`.

Empty allowlist in production **must not** deny the world when mode is `saas`. Empty allowlist in `allowlist` mode still fails closed (keep ADR-0024’s safety for staging/founder deploys).

Waitlist on `/` remains a **marketing** CTA (“get a demo / early access”), not the only way in. Self-serve signup is a second CTA once billing exists; until billing, self-serve can still create a free Product with spend caps already in the ledger.

### 4. Post-auth routing is a state machine, not a single `/studio` hop

After a valid session:

1. If `user_profiles.onboarding_completed_at` is null **and** they did not skip → `/onboarding/profile`.
2. Else if they have **zero** `product_members` rows and no pending invite accept → `/onboarding/organization`.
3. Else → last active Product (`synawood-active-product`) or `/home`.
4. Then evaluate **Guides** (ADR-0069).

Invite links (`/invite/[token]`) skip organization create. Profile may still run (skippable) before accept, or after accept — **after accept** is preferred so an invitee is not blocked from joining if they skip profile.

### 5. Auth errors stay plain English

No stack traces, no “JWT”, no “allowlist”. Denied modes: “Ask an owner for an invite” or “Join the waitlist”. Rate limits: “Too many tries. Wait a minute.”

## Consequences

- Middleware (`dashboard/lib/auth-paths.ts`) grows the three access modes. Tests for each.
- `/api/auth/allowlist-check` becomes mode-aware (always `{ allowed: true }` in `saas`, unless suspended).
- Founder-only deploys set `AUTH_ACCESS_MODE=allowlist` and keep `AUTH_ALLOWLIST_EMAILS`.
- Abuse: email confirmation required for password signup in `saas` (Supabase setting). Google is confirmed by the provider.
- Billing, SSO/SAML, SCIM, social login beyond Google: **out of this ADR**.

## Rejected

- **Auth0 / Clerk** as a rewrite. Supabase Auth already issues the cookies we use.
- **Allowlist forever** with a prettier login page. That is not SaaS.
- **One Auth user per Product.** People belong to multiple Products (agency, two brands).
- **Deleting waitlist.** It stays for demand capture and for modes that are not open signup.

## Rollout

1. Ship schema + mode flag defaulting to `invite_or_allowlist` so production does not suddenly open.
2. Enable `saas` on a preview URL; dogfood.
3. Flip production when Guides and organization onboarding exist (this program’s epic).
