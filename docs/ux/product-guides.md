# Product Guides (UX)

Dismissable in-app tutorials: first login, and the next login after a feature ships.

**Decision:** [ADR-0069](../adr/0069-dismissable-product-guides.md).  
**Architecture:** [saas-identity.md](../architecture/saas-identity.md) §8.  
**UI:** [ui/product-guides.md](../ui/product-guides.md).  
**Onboarding (account/org) is not a Guide:** [saas-onboarding.md](./saas-onboarding.md).

UX-first:

1. User sees a **modal** (start) and a **step card** (during), plus a **persistent chip** while in progress.
2. They cannot miss it: not a green button label, not a console log.
3. Dismiss and reload: progress is on the server; chip returns if `in_progress`.
4. Guides do not require a worker.

---

## 1. Jobs

1. **Brand-new user** (has an Organization) — know where Home, Studio, and Members are, then get out of the way.
2. **Existing user after a release** — hear that a named surface exists, try it or dismiss, never hear about that **same** Guide again.
3. **Busy user** — Not now / Skip guide is always visible. Core work (Approve, chat, Members) stays reachable.
4. **Curious user** — replay from Settings.

---

## 2. Mental model

A **Guide** is a short, named tour (`welcome-v1`, `studio-chat-titles-v1`).  
**Dismiss** means “do not auto-open this id again.”  
A **new feature** means a **new id**, written in the same PR as the feature.

We do not:

- Email the feature as the primary teacher
- Reset dismissed tours on deploy
- Teach via Studio Agent chat (“by the way you can…”) as the system
- Stack three modals in one login (one auto-prompt per login)

---

## 3. When the start modal appears

Evaluate after login, on the authenticated shell, **not** on `/onboarding/*`.

| Situation | What appears |
|---|---|
| First time they have a membership | Welcome Guide start modal |
| They dismissed welcome earlier | Nothing from welcome |
| Feature released since their **previous** login | That feature’s start modal (if they are not a brand-new user, unless the catalogue says include them) |
| Two features shipped while they were away | **One** modal this login (oldest `released_at`). The other waits for the **next** login |
| They are mid-guide (`in_progress`) and reload | No start modal; **resume** step card + chip |
| `AUTH_ACCESS_MODE` lock | Guides still work for people who can sign in |

**Next login after release** (founder requirement): we store `last_login_at` at session start. Eligibility uses the **previous** value. Same-session deploys do not pop a Guide until they sign in again. That is correct: “the next time they login after the release.”

---

## 4. Surfaces (what they see)

### 4.1 Start modal

- Title: Guide title (e.g. **Welcome to Synawood**)
- Body: 2–3 lines, why this exists
- Primary: **Start guide**
- Secondary: **Not now**
- No third “Remind me tomorrow” in v1
- Esc and overlay click = **Not now** (dismiss). Do not trap focus without Esc.

Can they miss it? It is a modal on first paint of `/home` (or wherever they land). If they navigate away without choosing, treat as **Not now** after they hit a `(app)` route? **No.** If they ignore it and click through the overlay… overlay must be dismissable. If they use the persistent shell underneath: **do not** use an undismissable full-screen blocker. Dimmed overlay with Not now is enough.

### 4.2 Step card (during)

- Step i of n
- Title + body (plain English, names real buttons)
- **Back** (hidden on 1)
- **Next**
- **Skip guide** (always visible; = dismissed)

Optional **spotlight** on `data-guide` target. If the control is off-screen, scroll it into view once. If missing, no spotlight.

### 4.3 Persistent chip (in progress)

Shell chrome (top bar or sidebar footer): **Guide** with step “2 / 5”. Click re-opens the step card. Survives modal close and reload. Completing or skipping removes the chip.

This is the recoverable indicator. Do not put progress only on Next.

### 4.4 Completion

Short modal or toast: **You’re done.** Primary: **Close**. No confetti requirement. No auto-start of the next queued Guide in the same login.

### 4.5 Settings replay

**Settings → Guides** (or a card on the Settings hub): list catalogue items with status Seen / Dismissed / Not seen. **Replay** on completed or dismissed. Replay is explicit; it is not an auto-prompt.

---

## 5. Welcome Guide (content)

Audience: all members, after Organization exists.

**Shipped:** `welcome-v1` (Home, Studio, Members). People who dismissed or completed it keep that progress.

**Target (ADR-0083):** `welcome-v2` — same first steps, then brand + **Approve**. New id so v1 dismiss stays sacred.

| Step | Route | Spotlight | Teach |
|---|---|---|---|
| 1 | `/home` | Dashboard nav | Home is where work status lives |
| 2 | `/studio` | Studio nav | Upload a take; chat + timeline. Not “generate a film” |
| 3 | Brand Studio | Logo upload | Logo burns into the Final |
| 4 | `/settings/members` | Members heading | Invite here; plan seat cap applies |
| 5 | Studio Approve | Approve control | Success is **Approve**. Skip is fine if the cut is not ready |

Keep steps ≤ 5. Do not tour Usage, AI Media, Brand DNA on first run. Do not require completing the Guide before Approve.

---

## 6. Feature Guide (template)

When a PR changes a **named** user-visible surface:

1. Add catalogue entry with new `id` and `releasedAt`.
2. 2–4 steps that name the real control (“Open Previous chats”, not “the slider”).
3. `includeNewUsers: false` unless welcome does not cover it.
4. Owners-only only if the feature is owner-only (example: invite settings).

Example (illustrative, implement when that surface should be taught):

- Id: `studio-chat-titles-v1`
- Summary: Threads get a short title; you can rename; previous chats sit above the thread.
- Steps: open Studio → point at title → click the clock for previous chats.

**Definition of done** for such PRs includes the Guide **or** an explicit “no Guide, welcome covers it” note in the PR.

---

## 7. Studio constraints

Creative Studio is a full-viewport editor ([studio-flows.md](./studio-flows.md), ADR-0016). Guides must not:

- Cover the player with an overlay that has no Dismiss
- Block Approve / Kill
- Speak as the Studio Agent
- Run a fake chat turn

If a step needs Studio, navigate first, wait for the layout, then spotlight. If Studio is still loading, show the step card without spotlight until `data-guide` exists (timeout ~2s, then no spotlight).

---

## 8. Edge cases (UX)

| Case | User sees |
|---|---|
| Skip profile + create org + welcome | Org page has no Guide. Home does. |
| Not now on welcome | Never auto-welcome. Feature Guides still allowed |
| Dismiss feature, we fix a typo in copy | Same id, no re-prompt. Copy change is not a new Guide |
| We substantially change the tour | New id (`welcome-v2`). Old dismissed users do not get v2 unless we want that (usually only brand-new users see latest welcome) |
| Two browsers | Server progress. Dismiss on laptop = no modal on phone |
| Replay | Start modal or step 1, their choice in Settings |

---

## 9. Copy rules

- Follow [copy-standards.md](../ui/copy-standards.md): no em dashes, short labels.
- Buttons: **Start guide**, **Not now**, **Next**, **Back**, **Skip guide**, **Replay**.
- Do not say “onboarding” on a feature Guide.
- Do not say “tenant” or “walkthrough modal component.”

---

## 10. Non-goals

- Pendo/Appcues as source of truth
- “Remind me in 3 days”
- Guides inside the Studio Agent
- Auto-generated tours from git diff
- Forcing completion before Approve
