# SaaS login, profile, and organization onboarding (UX)

Founder-facing and **customer-facing** flows for turning Synawood into a SaaS. Architecture: [saas-identity.md](../architecture/saas-identity.md). Decisions: [ADR-0067](../adr/0067-saas-public-identity.md), [ADR-0068](../adr/0068-organization-is-product-tenancy.md). UI spec: [saas-auth-onboarding.md](../ui/saas-auth-onboarding.md).

This **supersedes** [auth-and-onboarding.md](./auth-and-onboarding.md) for the SaaS target. That file remains the description of **current** waitlist-first production until `AUTH_ACCESS_MODE=saas`.

Principles in play: plain English (4), progress visible (6), one job per region (2). UX-first rule: status is a real surface (page, banner, toast), not a disabled button or console log.

---

## 1. Jobs to be done

1. **Stranger** — understand they can start now (not only waitlist), create an account, and not get stuck.
2. **New account, no team** — say who they are (or skip), name their organization, optionally invite people they already work with.
3. **Invitee** — join the team that invited them; skip personal questions if they want; land in the same Members list the owner uses.
4. **Returning member** — sign in and work. No wizard. Maybe a Guide (separate doc).
5. **Denied / locked env** — when access mode is not open SaaS, see invite-only or waitlist, never a blank page.
6. **Owner** — manage people in **Settings → Members**, not in a second roster invented at signup.

---

## 2. Public entry (marketing vs product)

The marketing landing (`/`) may keep **Join the waitlist** as a demand CTA (demo, enterprise, “not ready to self-serve”). SaaS adds a **second** equal or quieter CTA: **Start free** / **Sign in**.

| Audience | Primary | Secondary |
|---|---|---|
| Cold traffic, pre-billing | Waitlist **or** Start (founder picks which is hero when flipping mode) | The other |
| Existing member | Sign in | — |
| Invite email | Use the button in the mail (lands `/invite/...` after login) | Sign in |

Do not hide Sign in. Do not make Create account the only story if waitlist still matters for high-touch sales.

Copy: no em dashes. No “leverage your GTM OS.” Say what happens: “Sign in to Synawood.”

---

## 3. Login and signup

### 3.1 Pages

- `/login` — returning.
- `/signup` — new. Same visual system as login. Link each to the other (“Have an account? Sign in”).
- Google **first**, email + password **second**. Magic link is not in this program.

### 3.2 Happy path

1. User hits Continue with Google or submits email/password.
2. `/auth/callback` exchanges the session (existing PKCE).
3. They never see an allowlist error in `saas` mode.
4. Next URL: profile or organization or `next=` if already fully onboarded.

### 3.3 Errors (what they see)

| Cause | Surface | Copy direction |
|---|---|---|
| Wrong password | Inline on `/login` | “Email or password is wrong.” |
| Google cancelled | `/login?error=` | “Google sign-in was cancelled.” |
| Email not confirmed | `/login` | “Check your inbox to confirm your email.” |
| Mode `allowlist`, not listed, no invite | `/login` | “Access is invite-only. Join the waitlist or ask an owner.” |
| Rate limit | `/login` | “Too many tries. Wait a minute.” |
| Callback crash | `/login?error=` | “Sign-in failed. Try again.” Never a stack trace. |

### 3.4 What they must not see

- “JWT”, “RLS”, “allowlist”, “AUTH_ACCESS_MODE”
- A successful-looking callback that dumps them on `/studio` with no Product
- A 404 because `/signup` was never built

---

## 4. Profile onboarding (skippable)

**Route:** `/onboarding/profile`  
**When:** authenticated, `onboarding_completed_at` is null.  
**Job:** persist a few facts about the **person**. Not the team.

### 4.1 Layout (one screen)

- Title: **About you**
- Subtitle: **Optional. Takes under a minute. You can skip.**
- Fields (all optional):
  1. **Name** — text. Placeholder: “What should we call you?”
  2. **What you do** — four choices, not a free-text novel: Founder, Marketer, Editor, Other.
  3. **Why you’re here** — optional, three choices: Make ads, Run go-to-market, Exploring. Drop this field in implementation if the screen feels tall; ADR allows two fields.
- Primary: **Continue**
- Text button: **Skip for now** (same visual weight as a secondary, not hidden in tiny type)

### 4.2 Behaviour

| Action | Saves | Next |
|---|---|---|
| Continue (empty) | Same as skip: stamp completed, `onboarding_skipped = true` | Organization or app |
| Continue (some fields) | Those fields, skipped = false | Organization or app |
| Skip for now | Null fields, skipped = true, stamp completed | Organization or app |
| Reload mid-form | Unsaved fields lost (no draft). Stamp only on Continue/Skip | Stay until they act |
| Browser back | Allowed. Do not trap. | |

**Can they miss it?** No. It is a full page, not a toast.  
**Dismiss/reload:** if they close the tab before Continue/Skip, they see the page again (correct). After Skip, they never see it again unless Settings → Profile exists later.

### 4.3 Invitee

Same page **before** or **after** accept. Prefer **before** accept only if it does not delay join; **after** is specified in ADR-0067 as preferred so Skip cannot block `/invite/[token]`. Implementation: allow `/invite/*` even if profile is incomplete, then send to profile if still incomplete. Either way, Skip must not block the invite.

### 4.4 What this is not

- Not ADR-0037 job function on the Product.
- Not company size.
- Not a progress stepper of 7 steps. If we show a stepper at all: **1 You · 2 Organization** only, and only until org exists.

---

## 5. Organization setup

**Route:** `/onboarding/organization` (legacy `/onboarding` redirects here).  
**When:** profile stamped (or invite path), **zero** memberships.  
**Job:** create the team tenancy **or** join one. This **is** create Product.

### 5.1 Copy (customer)

- Title: **Your organization**
- Subtitle: **Your team’s Synawood. Studio, brand, and members live here.**
- Field **Organization name** (required) — maps to `products.name`
- Field **URL** (required, derived from name, editable) — maps to `products.slug`. Helper: “Used in links. Lowercase, no spaces.”
- Optional **Invite teammates** — up to 5 emails. Each row: email + job function (same control as Settings → Members). Helper: **You can invite more anytime in Settings → Members.**
- Alternate block: **Have an invite?** paste token / open link (existing pattern).

Primary: **Create organization**  
No Skip if they have no membership and no token.

### 5.2 After create

| Invites on the form | User sees |
|---|---|
| None | Toast: “Organization ready.” Land `/home` or `/settings/members` (either is ok; members is nicer if we want them to add people). Prefer **`/home`** plus a persistent but dismissable banner: “Invite your team in Settings → Members.” Banner gone after dismiss (local + optional profile flag later). |
| Some sent | Toast: “Invites sent.” Land `/settings/members` so they see pending rows. Failed emails: inline list, Product still created. |

They are **owner**. Members UI is the same panel as today (revoke, resend, copy link).

### 5.3 Cannot skip

Empty Studio is worse than a forced name+slug. If they try to hit `/studio` with zero memberships, middleware sends them here. Message if they bookmark Studio: **Create an organization or paste an invite to continue.**

### 5.4 Fit with members and invitations (non-negotiable)

| Do | Do not |
|---|---|
| Call existing invite API | New `org_invites` table |
| Use the same job-function dropdown as Members | A different role taxonomy on this screen |
| Send them to Members to manage people | A “team wizard” step 3–6 |
| Show pending invites on Members after this | A one-off “invited from onboarding” list that Settings cannot revoke |

Owner transfer, viewer Approve limits, disabled reasons: unchanged from [auth-and-onboarding.md](./auth-and-onboarding.md) Members section.

### 5.5 Multi-organization later

`/products` picker can be labelled **Organizations** in the shell. Creating a second Organization is **Settings → Create** (today: Create a Product). Same form, same API. Not part of first-run.

---

## 6. End-to-end scenarios

### A. New founder, skip profile, no invites

1. `/signup` → Google  
2. About you → **Skip for now**  
3. Organization name “Acme”, slug `acme` → Create  
4. `/home`  
5. Welcome Guide (see [product-guides.md](./product-guides.md)) — can **Not now**

**Time:** under two minutes. **Saved:** Auth user, empty profile stamp, Product, owner membership.

### B. New founder, fills profile, invites two people

1. Name “Ada”, Marketer, Make ads → Continue  
2. Org “Ada Labs”, invites `ed@x.com` (editor), `pat@x.com` (viewer)  
3. Lands Members: two pending  
4. Ed receives existing invite email, signs up, skips profile, accepts, appears as member  

### C. Invitee first

1. Opens `/invite/{token}` (maybe redirected to login)  
2. Signs up  
3. Accepts (profile skippable around this)  
4. Lands in the owner’s Organization  
5. Welcome Guide (not “create organization”)

### D. Returning, feature shipped yesterday

1. `/login`  
2. `/home`  
3. Feature Guide start modal once  

### E. Staging lock

`AUTH_ACCESS_MODE=allowlist`. Stranger sees invite-only copy. Waitlist still works.

---

## 7. Shell after onboarding

Customer chrome:

- Refer to the active tenancy as **{name}** (the Organization name).
- Settings card that today says “Members and invites” stays. Optional subtitle: “People in {name}.”
- Settings card “Create a Product” → **Create an organization** with a one-line note for operators: “Same as a Product in the database.” Founder-facing Settings can say **Create an organization** only.

Engineers still say Product in PRs.

---

## 8. Accessibility and interruption

- Keyboard: Google button, fields, Continue, Skip, Create. Focus order top to bottom.
- Skip is a real `<button>`, not a text link that looks like body copy only.
- Do not auto-advance on a timer.
- Closing the tab is always allowed (no `beforeunload` trap).
- Mobile: one column; invite rows stack. See [responsive.md](../ui/responsive.md).

---

## 9. Analytics (product, not vanity)

Useful later: profile skip rate, org created without invites, invite accept from onboarding vs Members. Not a launch blocker. Funnel KPIs remain conversion existence ([CONTEXT.md](../../CONTEXT.md)) — signup is not a Funnel stage until we define one.

---

## 10. Explicit non-goals (UX)

- Billing plan picker, trial clock, credit card
- Organization logo upload on first run (brand kit is Settings)
- Public directory of Organizations
- Forcing the private example as the Organization name
- Intercom during onboarding
- Multi-step “tell us your ICP” interview
