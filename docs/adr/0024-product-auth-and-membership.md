# ADR-0024 — Product membership as the tenancy unit

**Status:** accepted  
**Date:** 2026-07-21  
**Amended by:** [ADR-0067](./0067-saas-public-identity.md) (public SaaS login; allowlist is an ops valve), [ADR-0068](./0068-organization-is-product-tenancy.md) (customer chrome may say Organization; still no org *table*)  
**Relates to:** ADR-0009 (Blob + Postgres), ADR-0011 (local-first), `CONTEXT.md` (Product context)  
**Supersedes in part:** single-operator-only framing in `docs/architecture/auth-and-security.md` (v1 gate remains; tenancy model expands)

## Context

Synawood began as a founder-only operator console with the private example as an example Product context. Plan 07 (#96) turns the same codebase into something others can use later: sign up, create a Product, own it, invite editors.

Temptation: invent an **Organization** (or tenant / workspace) above Product. That would:

- Contradict `CONTEXT.md`, which already defines **Product context** as the product-specific boundary and explicitly avoids tenant / workspace language
- Duplicate folder and DB scoping we already use (`products/{name}/`, `product_id` columns, blob prefix `marketing-os/{productId}/`)
- Delay shipping behind an extra entity we do not need for v1 or early multi-user

Separately, the private example must not be the **identity of the app**. Hard-seeding “founder as the private example owner” as the only path would freeze Synawood as a the private example-only tool.

## Decision

1. **Product is the tenancy unit.** Membership (`product_members`) ties a Supabase Auth user to a `productId` with role `owner` | `editor` | `viewer`. There is **no** org hierarchy above Product in v1 (or until a future ADR supersedes this).

2. **the private example is a Product, not the platform.** The founder creates a Product (slug/display name of their choosing, e.g. demo / demoreader) and becomes `owner`. Optional local seed of a the private example row is convenience only, never a productization requirement.

3. **Public access is waitlist-first.** *(Amended by ADR-0067.)* Waitlist stays a marketing CTA. Self-serve signup is in scope once `AUTH_ACCESS_MODE=saas`. Until that flag is on in an environment, this v1 rule still holds.

4. **Auth signup/login is founder-allowlisted in v1.** *(Amended by ADR-0067.)* Allowlist remains the gate in `allowlist` / `invite_or_allowlist` modes. It is not the customer default after the SaaS flip.

5. **Create Product is the post-auth path.** *(Amended by ADR-0068.)* Same API and tables. Customer chrome may label this **organization setup**. Creator is still `owner`. Profile questions are a separate skippable step, not a second tenancy.

## Consequences

- Schema work (#99) models arbitrary `productId` membership; the private example seed is optional/dev.
- **Code and SQL** still say Product (`product_id`, `product_members`). **Customer chrome** may say Organization for that same row ([ADR-0068](./0068-organization-is-product-tenancy.md), `CONTEXT.md`). Do not add an `organizations` table here.
- Landing (#102) and onboarding (#103) implemented waitlist + create-Product against this ADR. SaaS signup and skippable profile: [ADR-0067](./0067-saas-public-identity.md), [ADR-0068](./0068-organization-is-product-tenancy.md).
- Billing, SSO/SAML, and multi-Product **parent** org trees remain non-goals until new ADRs.

## Rejected alternatives

- **Organization above Product** — premature hierarchy; Product already matches repo and storage boundaries.
- **the private example-hardcoded app** — blocks turning Synawood into a product others can use.
- **Open signup on day one** — invite chaos and support load before waitlist/ops are ready.
