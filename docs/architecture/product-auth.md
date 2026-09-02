# Product auth and membership

How Synawood authenticates users and scopes data to a **Product**. Decision record: [ADR-0024](../adr/0024-product-auth-and-membership.md). Operator secrets and Blob/AI guardrails remain in [auth-and-security.md](./auth-and-security.md).

**SaaS target** (public signup, skippable profile, Organization copy, Guides): [saas-identity.md](./saas-identity.md), [ADR-0067](../adr/0067-saas-public-identity.md), [ADR-0068](../adr/0068-organization-is-product-tenancy.md), [ADR-0069](../adr/0069-dismissable-product-guides.md). This file remains accurate for an environment until `AUTH_ACCESS_MODE=saas`.

## Vocabulary

| Term             | Meaning                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| **Synawood**     | The app / platform                                                                   |
| **Product**      | Tenancy unit (`productId`); maps to `products/{name}/`, DB `product_id`, blob prefix |
| **Member**       | Auth user with a `product_members` row for that Product                              |
| **Owner**        | Admin of the Product (invite, role changes, destructive settings)                    |
| **Editor**       | Can mutate Studio / content within policy                                            |
| **Viewer**       | Read-only; cannot Approve or spend                                                   |

Do **not** introduce Organization / tenant / workspace as **tables**. Customer chrome may say Organization for the Product row ([ADR-0068](../adr/0068-organization-is-product-tenancy.md), `CONTEXT.md`). Code and SQL stay on `product_id`.

the private example is one Product the founder may create. It is not the name of the app.

## Auth providers (v1)

- Supabase Auth: email/password and Google OAuth
- Session via cookies (`AUTH_COOKIE_NAME`); middleware validates user on `/(app)/*` and product APIs
- **Allowlist:** only listed emails may complete signup or (if configured) login until we open access (#102)
- Invited users may authenticate when their email matches an open invite (Plan 07 slice 5)

### Google OAuth setup

**App callback:** `/auth/callback` (client page) exchanges the Auth `code` for cookies in the browser (so the PKCE verifier is present), allowlist-checks, then redirects to the remembered post-auth path (default `/studio`). Prefer an exact `redirectTo` of `/auth/callback` (no query string); store `next` in a short-lived cookie. Middleware also forwards stray `/?code=…` (GoTrue site_url fallback) to `/auth/callback`. **Local:** use only `http://localhost:3000` (not `127.0.0.1`) so cookies survive the Google round-trip.

**Google Cloud Console** (OAuth client type **Web**):

| Environment                 | Authorized redirect URI (Supabase Auth, not the Next app)     |
| --------------------------- | ------------------------------------------------------------- |
| Local stack                 | `http://127.0.0.1:54341/auth/v1/callback`                     |
| Hosted Synawood project     | `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback` |

Also allow the JS origins you use (`http://127.0.0.1:3000`, production dashboard origin).

**Supabase redirect allowlist** (Dashboard → Authentication → URL Configuration, or `supabase/config.toml` locally):

| Environment | Site URL / additional redirect URLs                                                             |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Local       | `http://localhost:3000`, `http://localhost:3000/auth/callback` (optional: `127.0.0.1` variants) |
| Hosted      | Production dashboard origin + `/auth/callback`                                                  |

**Enable provider**

1. **Hosted:** Authentication → Providers → Google — paste Client ID / secret from Google Cloud.
2. **Local:** set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (e.g. in `supabase/.env`), set `[auth.external.google] enabled = true` in `config.toml`, restart `npx supabase stop && npx supabase start`.

**Local smoke fallback:** if Google Cloud / local external provider is not ready, email/password on `/login` remains the verified path. Document the gap in the PR; do not block Plan 07 on OAuth credentials alone.

**Continue with Google** lives on `/login` (and `/signup` when #102 ships). `signInWithOAuth({ provider: 'google', options: { redirectTo } })` must use the app callback URL above.

## Membership model

```text
auth.users ──< product_members >── products
                 role: owner | editor | viewer
```

- Migration: `supabase/migrations/0013_product_members.sql`
- Creating a Product inserts `product_members` with `role = owner` for the creator (#103).
- Invites table `product_invites`: email + productId + role (`editor` | `viewer`) + token.
- API helpers: `dashboard/lib/product-membership.ts` — `requireProductRole` fails closed.
- Onboarding UI: `/onboarding` (create Product or paste invite), `/invite/[token]` (accept), `/settings/members` (owner invites). Zero memberships redirect to `/onboarding`.
- Active Product cookie: `synawood-active-product` (set on create/accept).
- Access: allowlisted **or** existing membership **or** open invite may sign in; zero memberships → `/onboarding`.
- SQL: `public.is_product_member(product_id, min_role)` for future RLS on product-scoped tables.
- RLS: members can `select` their own membership rows; DML remains service_role until owner APIs land.
- Optional local the private example owner seed is **comment-only** in the migration — not automatic.

## Route map (target)

| Area                | Path                                      | Gate                                                                                                   |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Marketing landing   | `/`                                       | Public                                                                                                 |
| Waitlist submit     | `/api/waitlist`                           | Public (service_role insert)                                                                           |
| Allowlist pre-check | `/api/auth/allowlist-check`               | Public                                                                                                 |
| Login / signup      | `/login`, `/signup`                       | Public pages; **allowlist** before session                                                             |
| OAuth callback      | `/auth/callback`                          | Supabase exchange + allowlist                                                                          |
| Operator app        | `/home`, `/(app)/*` routes (`/studio`, …) | Authenticated + (allowlisted \| member \| invited); Product via `synawood-active-product` / API `productId` |
| Onboarding          | `/onboarding`, `/invite/[token]`          | Authenticated; create Product or accept invite                                                         |
| Members             | `/settings/members`                       | Owner invites; editor+ can list                                                                        |
| Product APIs        | `/api/*` except public                    | Authenticated + allowlisted + membership (`requireStudioAccess`)                                       |

### Allowlist (`AUTH_ALLOWLIST_EMAILS`)

- Comma-separated emails. Matched case-insensitively.
- **Empty + production:** deny all sessions (fail closed).
- **Empty + local/dev:** allow any email (DX). Set your founder email in `dashboard/.env.local` for a realistic gate.
- Enforced in: signup/login UI pre-check, OAuth callback, middleware on protected routes (signs out if denied).

## Product context in the session

Until onboarding (#103) stores an active Product cookie, APIs take `productId` (query/body) or resolve it from `projectId` / `slotId` / `renderJobId` / `publishId` / `finalAssetId`. Missing `productId` on product-scoped list/create routes → **400** (no silent `demo` default).

- Middleware (#100): **fail closed** — every path except `/login`, `/signup`, `/auth/callback`, `/api/health` requires a session (`dashboard/lib/auth-paths.ts`). APIs return **401 JSON**; UI redirects to `/login`.
- Route handlers: `requireStudioAccess` → `requireUser` + `requireProductRole` (viewer for GET, editor for writes). Missing membership → **403**.

## Waitlist confirmation mail (#340)

`POST /api/waitlist` always writes the email first (no Auth user — ADR-0024). Then it may send one confirmation.

| Local / env | What happens |
|---|---|
| `RESEND_API_KEY` unset (default localhost) | Row saves. Send is **skipped**. Landing still shows “You are on the list.” No Mailpit/Inbucket wire in v1. |
| `RESEND_API_KEY` set | One Resend email. Copy is honest: not a magic link, not dashboard access. `waitlist_entries.email_sent_at` stamps success. |
| Provider error | Row stays. JSON still `ok: true` with `emailSent: false`. Landing does not claim the mail went out. |

From (optional): `WAITLIST_MAIL_FROM`. Names only in `.env.example`.

## Env (names only)

Document in `.env.example`:

- `AUTH_ALLOWLIST_EMAILS` — comma-separated founder (and early) emails
- Existing Supabase Auth URL/keys (Synawood project only)
- Local Google (optional, for `supabase start`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — usually in `supabase/.env`, not the Next app

## Related plans

- [.cursor/plans/generated/07-product-auth-landing.plan.md](../../.cursor/plans/generated/07-product-auth-landing.plan.md)
- Issues: #96 (epic), #99–#103, #131 (docs), #340 (waitlist confirmation mail)
