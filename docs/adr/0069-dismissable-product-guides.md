# ADR-0069 — Dismissable product Guides

**Status:** accepted  
**Date:** 2026-08-23  
**Related:** [ADR-0067](./0067-saas-public-identity.md) (post-auth routing), [ADR-0016](./0016-studio-editor-chrome.md) (Studio chrome — Guides must not steal the timeline)  
**Docs:** [ux/product-guides.md](../ux/product-guides.md), [ui/product-guides.md](../ui/product-guides.md), [architecture/saas-identity.md](../architecture/saas-identity.md)

## Context

New SaaS users land in a dense operator shell (Studio, pipeline, members). A first-run walkthrough is necessary. Shipping a new surface (for example chat thread titles) without a prompt means existing users never discover it.

Requirements from the founder:

1. Dismissable tutorial on **first login**.
2. After a **feature ships**, prompt the user the **next time they log in**.
3. Must not nag after dismiss.

LocalStorage-only checklists fail: new laptop, the tour returns; or it never appears because a shared browser already dismissed it.

## Decision

### 1. Guides are versioned records, not a single boolean

A **Guide** is an in-app tutorial with a stable `id` (slug), `kind` (`welcome` \| `feature`), `released_at` (timestamptz), ordered **steps**, and optional `audience` (all members, owners only, Studio editors).

Catalogue lives in **code** (`dashboard/lib/guides/catalogue.ts`) shipped with the release. The database stores **progress**, not the step copy. Changing copy does not require a migration. Changing identity (a new tour) uses a **new id** (`welcome-v2`, `studio-chat-titles-v1`).

### 2. Progress is per user, persisted in Postgres

`user_guide_progress`:

| Column | Meaning |
|---|---|
| `user_id` | Auth user |
| `guide_id` | Catalogue id |
| `status` | `pending` \| `in_progress` \| `completed` \| `dismissed` |
| `step_index` | Resume point |
| `updated_at` | |

Primary key `(user_id, guide_id)`. RLS: own rows only. Service role may insert `pending` rows at login (or the client upserts on first evaluation).

**Dismiss** and **completed** are terminal. We do not auto-reset them. A *new* Guide id is how we teach a new thing.

### 3. When a Guide becomes eligible

Evaluate after auth routing (ADR-0067) once per **browser session** (sessionStorage flag `mos-guides-evaluated`) plus always on login (full page load after `/auth/callback`).

**Welcome (`kind = welcome`):**

- Eligible if the user’s `user_profiles.onboarding_completed_at` is set **or skipped**, they have at least one membership (or we delay welcome until organization exists), and no terminal progress for `welcome-*`.
- Show at most **one** welcome Guide (highest `released_at` that the binary contains).
- If they created the account this session, show after organization setup, not on the auth page.

**Feature (`kind = feature`):**

- Eligible if `released_at` ≤ now, the running app contains that id, progress is not terminal, **and** `user_profiles.first_seen_at` **or** `auth.users.created_at` **< `released_at`** *or* we use **`last_session_at < released_at`**.
- **Rule the founder asked for:** prompt on the **next login after release**. Implementation: store `user_profiles.last_login_at` (updated at session start). A feature Guide is eligible when `last_login_at` (previous value, before this write) is null or `< released_at`, and this login’s timestamp is `≥ released_at`.
- Users who **sign up after** `released_at` do **not** get that feature Guide (the welcome Guide should already cover current product). Exception: set `audience.include_new_users: true` on the catalogue entry if the feature is not in welcome.

### 4. Presentation: modal + optional coach marks, never a blocking wizard

- **Start:** one modal: title, 2–3 line why, primary **Start guide**, secondary **Not now** (dismisses for this Guide).
- **During:** spotlight + step card (title, body, Next / Back / Skip guide). Skip = dismissed.
- **Studio:** if the step targets Studio, open `/studio` first; do not cover the player with an undismissable overlay (UX-first: they must see Minimize / Dismiss). Persistent **Guide** chip in the shell while `in_progress` so reload does not lose the tour (same pattern as generation banners).
- **Not now** vs **Skip guide:** Not now = dismissed (will not auto-open again). We do **not** add a “remind tomorrow” in v1.

A **Guides** item under Settings (or `?guide=welcome-v1`) lets them re-run a completed Guide (sets status back to `in_progress` at step 0). Dismissed Guides can be re-opened from Settings only.

### 5. Shipping a feature Guide is part of the feature’s PR

Definition of done for user-visible SaaS features that change a surface:

1. Add a catalogue entry with `released_at` = merge time (or the deploy you care about).
2. Steps name the real UI (button labels, routes).
3. Progress id is unique.

Do not auto-scrape git. Humans write the Guide.

One-pager: [guides/shipping.md](../guides/shipping.md). PRs that add a user-visible surface tick the Guide checkbox (catalogue id **or** “welcome covers it”).

## Consequences

- Session start API: `POST /api/me/session` updates `last_login_at`, returns `{ profile, eligibleGuides }`.
- Middleware must not block JSON APIs because a Guide is pending.
- Preview deploys: `released_at` in the future hides the Guide; or use `GUIDE_FORCE_ID` for QA.
- Analytics (optional): `guide_shown`, `guide_dismissed`, `guide_completed` as `audit_events` with `product_id` nullable (welcome may fire before Product exists — then skip audit or use null product).

## Rejected

- **Intercom / Appcues / Pendo** as the source of truth. We can embed later; eligibility stays ours.
- **localStorage as the only store.** Multi-device and “next login after release” would lie.
- **Resetting dismiss on every deploy.** That is harassment. New id for new Guide.
- **Chatbot “tips” in Studio Agent.** Guides are chrome, not the Studio Agent.
- **Email for every feature.** Login prompt is the requirement.

## Edge cases

| Case | Behaviour |
|---|---|
| Two feature Guides eligible | Queue: one modal at a time, FIFO by `released_at`. After complete/dismiss, next on **this** session only if they click “Show next”; otherwise next **login**. Default: **one Guide prompt per login** to avoid stacking. |
| User dismisses welcome | Do not show welcome again. Feature Guides still eligible. |
| Invitee first login | Welcome after org join. Feature Guides: if `created_at` after all `released_at`, skip features unless flagged. |
| `last_login_at` missing (legacy users) | Treat as `created_at`. First login after this ships may show current feature Guides once — acceptable. |
