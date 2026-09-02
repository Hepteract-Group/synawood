# Runbook: Tracking Audit (Funnel + GA4)

**Purpose:** Confirm every funnel stage is measurable before spending on ads. Fix gaps; never invent conversion rates from missing data.
**Cadence:** Once at Phase 1 start; re-run after any tracking/consent change.
**Owner:** Founder (or marketing operator with production + GA4 + product-admin access).
**Time budget:** 60–90 minutes first run.
**Automation status:** manual

## Inputs

- Access: production site, Vercel project env vars, GA4 property, product admin analytics, Supabase (optional).
- Funnel map in that Organization’s `config` / tracking map (do not restore `products/demo/config.ts`).
- Product app analytics live in the product’s own repo, not here.

## How tracking works (read once)

| Sink | What it measures | When it fires |
|---|---|---|
| **Vercel Analytics** | Visitors / page views (cookieless) | Always — no cookie banner needed |
| **GA4 (gtag.js)** | Marketing attribution + page views + custom events | Only if `VITE_GA4_MEASUREMENT_ID` is set **and** user accepts marketing cookies |
| **Supabase `analytics_events`** | Product funnel events (`editor_open`, `signup_completed`, …) | Always via `trackEvent()` — independent of GA4 consent |

So: empty GA4 with healthy Vercel numbers usually means **consent gate** and/or **missing env var**, not “the site is dead.”

## Steps

### A. Prove GA4 can receive *any* hit (15 min)

1. **Check Vercel env.** Project `demo` → Settings → Environment Variables → Production.
   - Done = `VITE_GA4_MEASUREMENT_ID` exists and matches GA4 Admin → Data streams → Measurement ID (e.g. `G-…`).
   - If missing: add it, redeploy Production, wait for deploy to finish.
   - Note (2026-07-17): ID `G-6RPTCF0WYS` *was* baked into the production bundle; empty GA4 was **not** an env-var miss.
2. **Incognito smoke test on example.com** (disable ad blockers).
   - Open DevTools → Network. Filter `collect` or `google-analytics`.
   - Accept **Accept all** on the cookie banner (decline = GA4 never loads — by design).
   - Done = `gtag/js?id=G-…` loads **and** a `g/collect` (or `region1.google-analytics.com/g/collect`) request fires.
   - Console check: `Object.prototype.toString.call(dataLayer[0])` should be `[object Arguments]`. If you see `[object Array]`, the gtag stub is still broken (fixed in the former reader `src/analytics/gtag.ts`).
3. **GA4 Realtime** (not the Data stream "tag instructions" page — that warning lags).
   - GA4 → Reports → Realtime. Refresh the site once with consent accepted.
   - Done = you appear as 1 user in Realtime within ~60s.
4. **If Realtime stays empty** after deploy of the Arguments-stub fix + Accept all: check ad blockers, then Tag Assistant. Do not proceed to ads.

### B. Prove product funnel events land (20 min)

Two separate pipes — wrong UI looks like a broken funnel:

| Path | Where events go | Where you look |
|---|---|---|
| **Layer A free tools** (`/tools/...`, e.g. receipt-generator) | `trackToolComplete` → API → tool analytics store | Admin → **Tool analytics** |
| **Workspace / editor** (`/editor`) | `trackEvent` → Supabase `analytics_events` (+ GA4) | Supabase table `analytics_events`, or GA4 Realtime/DebugView — **not** Tool analytics |

1. **Layer A (already working if receipt-generator showed up):** complete a free tool → row in Tool analytics. That counts as tool started + document completed for acquisition.
2. **Workspace path:** open `/editor`, load a PDF, export once. Then in Supabase:
   ```sql
   select event, created_at, url
   from analytics_events
   where created_at > now() - interval '1 hour'
     and event in ('editor_open','pdf_loaded','first_pdf_loaded','export_attempt','first_export_completed','signup_completed','checkout_started')
   order by created_at desc;
   ```
   Or GA4 Realtime → Events (with marketing consent).
3. Done = Layer A visible in Tool analytics; workspace events visible in `analytics_events` and/or GA4.
4. Known gaps:
   - `second_workflow` — may not be a dedicated event yet.
   - `subscription_activated` — Stripe is source of truth; client only has `checkout_started`.
   - `retained_30d` — Stripe / retention query, not a page event.

### C. Dual-write check: same event → GA4 (10 min)

1. With marketing consent accepted and GA4 Realtime open, trigger `editor_open` (open editor).
2. In DevTools Network, confirm a GA4 event payload includes the custom event name (or check GA4 DebugView if configured).
3. Done = custom events are not silently dropped. If Supabase has the event but GA4 does not: consent / gtag init issue (Section A), not missing `trackEvent` calls.

### D. Record baselines (10 min)

1. For the last 7 days, fill absolute counts into the Organization’s tracking baselines (not a committed the private example `config.ts`).
2. Prefer: Vercel (traffic proxy until GA4 is trusted) + Supabase/admin (product stages) + Stripe (paid / retained).
3. Keep unmeasured stages listed in `unmeasuredStages` — never treat missing instrumentation as “0 conversions forever.”

### E. Exit criteria — Phase 1 “tracking OK”

All must be true before Google Search spend:

- [ ] GA4 Realtime shows a consented visit
- [ ] `VITE_GA4_MEASUREMENT_ID` set on Production and redeployed after any change
- [ ] Funnel events for tool started / document completed / signup visible in Supabase (or documented as missing with a fix ticket)
- [ ] Paid attributed via Stripe (even if GA4 ecommerce is deferred)
- [ ] `config.ts` baselines updated with date + notes

## Outputs

- Organization tracking baselines in the app (not a committed the private example `config.ts`)
- Optional private note under gitignored `docs/local/` with pass/fail per stage
- Fix tickets for any missing events

## Escalation

- GA4 empty + Vercel healthy → fix consent/env first; do not rebuild the funnel.
- Events in code but not in Supabase → check RLS / insert permissions on `analytics_events`, not marketing copy.
- Founder blocked on GA4 admin access → pause audit; do not invent numbers.

## Change log

- 2026-07-16 — v1: GA4 consent gate + Supabase `trackEvent` dual path documented from the former reader source.
