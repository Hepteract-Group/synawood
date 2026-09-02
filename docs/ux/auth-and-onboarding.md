# Auth and onboarding (UX)

Founder and future members entering Synawood. Architecture: [product-auth.md](../architecture/product-auth.md). Decision: [ADR-0024](../adr/0024-product-auth-and-membership.md).

**SaaS target flows** (public signup, skippable profile, organization setup, Guides): [saas-onboarding.md](./saas-onboarding.md), [product-guides.md](./product-guides.md). This file describes **current** waitlist-first production until `AUTH_ACCESS_MODE=saas`.

## Jobs to be done

1. **Stranger** — understand what Synawood is and join the waitlist.
2. **Allowlisted founder** — sign in or sign up, then create their first Product.
3. **Invitee** — accept invite, land in the Product with the right role.
4. **Denied user** — see a clear message (not a blank 404), with waitlist or support path.

## Public landing → waitlist

- Primary CTA: **Join the waitlist** (email).
- Secondary: **Sign in** (quiet; for people who already have access).
- Do not present open “Create account for everyone” as the hero action in v1.
- Success: confirmation that they are on the list; no dashboard access.

Details: [marketing-landing.md](../ui/marketing-landing.md).

## Login / signup (v1)

- Pages: `/login`, `/signup` (`/signup` lands in #102; until then create-account mode lives on `/login`).
- **Continue with Google** first, email/password second. OAuth returns via `/auth/callback` then `next` (or `/studio`).
- Failed OAuth shows a plain error on `/login` (`?error=`), not a blank screen.
- **Allowlist:** if the email is not allowlisted (and has no valid invite), show a plain message: access is invite-only; offer waitlist link (#102).
- Errors in plain English (UX principle 4).

## Sign out

- Control lives in the operator sidebar, after Dashboard…Settings: **Marketing site** and **Sign out**. Same two actions inside the phone Menu.
- **Marketing site** goes to `/` (public landing) and keeps the session.
- **Sign out** ends the Supabase session, then full-page navigates to `/`. The landing still has **Sign in**.
- Failure: sentence under the control (`role="alert"`). Do not fail only in the console.

## Post-auth onboarding

When the user has **zero** Product memberships:

1. **Create a Product** — name (required), slug (derived, editable).
2. Submit → user is `owner` → enter operator app for that Product.
3. Alternate: **Have an invite?** paste/open invite link.

When the user already has memberships: skip to the last-active Product (or picker when multi-Product exists).

the private example example: founder creates Product named demoreader (slug `demo`). That is content configuration under Product context — not a special app mode.

## Members (Settings)

- Owner invites by email + role (`editor` | `viewer`; owner transfer later).
- Pending invites visible; revoke supported.
- Viewer cannot Approve or trigger paid generate; explain why the control is disabled.

## Denied / empty states

| State | User sees |
|---|---|
| Not signed in on `/(app)` | Redirect to login with `next=` |
| Signed in, not allowlisted / no membership | “You do not have access yet” + waitlist |
| Viewer hits Approve | Disabled control + short reason |
| Invite expired | “Ask an owner for a new invite” |

## Explicit non-goals (UX)

- Organization wizard or billing plan picker
- Public Product directory / discovery
- Auto-create the private example Product without the create form (optional local seed is a dev convenience, not the UX path)
