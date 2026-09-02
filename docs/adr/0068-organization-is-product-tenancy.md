# ADR-0068 — Organization is Product tenancy (SaaS copy + setup)

**Status:** accepted  
**Date:** 2026-08-23  
**Amends:** [ADR-0024](./0024-product-auth-and-membership.md) §5 and the “never say Organization” copy rule  
**Does not supersede:** ADR-0024 §1 (no second tenancy table). [ADR-0037](./0037-functional-roles.md).  
**Related:** [ADR-0067](./0067-saas-public-identity.md)  
**Docs:** [system-design/saas.md](../system-design/saas.md), [ux/saas-onboarding.md](../ux/saas-onboarding.md), [ui/saas-auth-onboarding.md](../ui/saas-auth-onboarding.md)

## Context

Customers say **organization** and **team**. Our schema says **Product**. ADR-0024 rejected an Organization *table* above Product so we would not duplicate `product_id`, blob prefixes, and `products/{slug}/`.

That rejection still holds. What failed is **copy**: “Create a Product” sounds like “add the private example as a SKU”, not “start my company’s Synawood”. Settings already treats a Product as the team you invite people to (`/settings/members`).

The founder asked for:

1. Short, skippable **personal** onboarding (who you are).
2. **Organization setup** that fits the current members/invite settings.

Those are two different objects: a **User profile** vs the **Product** row.

## Decision

### 1. No `organizations` table in this program

Tenancy remains `products` + `product_members` + `product_invites`. Blob prefix, RLS, and `synawood-active-product` do not change.

**Organization** is the SaaS **UI word** for that Product tenancy — the company or team that owns Studio, brand, and members.

**Product** remains the domain word for GTM context (any marketed product, e.g. the private example as a private example) and the database name.

When we need one bill for many marketed products, a future ADR may add a parent. Until then, one Organization screen = one Product row.

### 2. User profile is person-level and skippable

Table `user_profiles` (PK `user_id` → `auth.users`):

| Column | Required to finish? | Purpose |
|---|---|---|
| `display_name` | no | Header, members list, audit |
| `job_title` | no | “Founder”, “Marketer”, “Editor”, “Other” — **not** ADR-0037 `functional_role` |
| `intent` | no | Why they signed up (make ads / run GTM / exploring) |
| `onboarding_completed_at` | set on Continue **or** Skip | Stops the profile step from looping |
| `onboarding_skipped` | true if Skip | Analytics; we still persist whatever they typed |

Skip writes the row with nulls and timestamps. Never block invite accept on profile.

Do **not** store company size, phone, or address in v1.

### 3. Organization setup *is* create Product, with SaaS fields

`/onboarding/organization` uses the same `POST /api/products` path as today’s `/onboarding`.

Visible fields:

| UI label | Maps to | Required |
|---|---|---|
| Organization name | `products.name` | yes (unless joining via invite) |
| URL slug | `products.slug` | yes, derived, editable |
| What you sell (one line) | `products.tagline` or brand one-liner if the column exists; else store on profile-adjacent `products.metadata` **only if** we already have a json extras column — **do not** invent a parallel company table | no |

Optional step on the same screen (not a second wizard): **Invite teammates** — 1–5 emails + job function. Each call is the existing owner invite API (`POST /api/products/{id}/invites`). After create, the user is `owner` / `founder` (ADR-0037). Then redirect to `/settings/members` with a success toast, **or** `/home` if they invited nobody.

Skip organization: only allowed if they already have a membership **or** a valid invite token in the session. Otherwise the empty state is “Create an organization or paste an invite” — not the Studio shell with no Product.

### 4. Members settings stay the source of truth for people

Do not build a second roster on the onboarding screen.

- Onboarding may *send* invites.
- `/settings/members` remains where owners revoke, resend, change job function, and copy links.
- Roles copy on `/settings/roles` stays canonical.

Organization setup copy must say: “You can invite more people anytime in Settings → Members.”

### 5. UI copy matrix

| Surface | Say | Do not say |
|---|---|---|
| Signup / login | Account, email, sign in | Tenant, workspace |
| Profile step | You, your name | Organization |
| Org step | Organization (subtitle: “Your team’s Synawood — Studio, brand, members”) | Workspace, tenant |
| Settings members | Members of **{organization name}** | “Product members” in customer-facing chrome |
| GTM docs | Product context (customer brand in the app) | Organization |
| Code / SQL | `product_id`, `product_members` | `org_id` |

Engineers keep Product. Customers see Organization where they mean “my team”.

## Consequences

- `CreateProductForm` labels change to Organization name / URL. API unchanged.
- Members heading uses the active Product’s `name`.
- Profile APIs: `GET/PATCH /api/me/profile`. RLS: user reads/writes own row only.
- Invitee path: login → optional profile skip → `/invite/[token]` → members of that Organization.
- Multi-Product switcher (`/products`) can later be labelled “Organizations” in the shell; internal route may stay `/products`.

## Rejected

- **`organizations` + `organization_members` plus `products`.** Two rosters, two invite tables, Settings would fork. Does not “fit nicely” with current members.
- **Forcing profile fields.** The founder asked for skip.
- **Collecting billing details here.** No Stripe in this ADR.
- **Using ADR-0037 functional role as the profile job title.** One is tenancy/job-on-this-Product; the other is “who I am as a person”. An invitee can be “Marketer” on the profile and `publisher` on the Product.

## Follow-up (not this ADR)

Parent Organization for agencies (one bill, many Products). Requires billing + a new ADR. Do not sneak it into `user_profiles`.
