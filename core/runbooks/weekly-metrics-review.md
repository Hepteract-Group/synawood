# Runbook: Weekly Metrics Review

**Purpose:** One honest weekly look at the funnel — what moved, what didn't, what we change next week. This is the accountability heartbeat of the whole system.
**Cadence:** Weekly — Friday, 30 minutes.
**Owner:** AI agent prepares the pack; founder reviews and decides.
**Time budget:** 30 min founder time.
**Automation status:** manual (target: automated KPI pull via `core/analytics/` collectors + cron-generated review pack)

## Inputs

- Funnel data: PostHog / Supabase `analytics_events` (tool started, document completed, signup, trial, paid), Stripe (MRR, churn), GA4 / Search Console (traffic, queries)
- Content archive from the founder content batch (what published, engagement)
- Ads data once live (spend, CPC, conversions by campaign)
- Last week's decisions (were they executed?)

## Steps

1. **Pull the funnel table.** This week vs last week vs baseline, absolute numbers:
   qualified traffic → tool started → document completed → account created → second
   workflow → paid → 30-day retained. Done = table in the review doc.
2. **Pull commitments.** Calendar events vs completion signals. Missed items listed
   explicitly — rescheduled or killed, never carried silently.
3. **Content readout.** Published items ranked by engagement/clicks; one lesson noted.
4. **Ads readout (when live).** Spend, CPC, conversion by campaign vs kill rules.
5. **Decide.** Maximum three changes for next week, each owned and calendared.
6. **File it.** Save to `products/{product}/strategy/reviews/{date}.md`. Red flags
   (missed commitments, funnel regressions, kill-rule breaches) go at the top.

## Outputs

- Weekly review doc with funnel table, commitment audit, and ≤3 decisions
- Updated calendar events for next week's commitments

## Escalation

- Data source broken → fixing tracking becomes next week's top priority; a blind week is worse than a slow week.
- Funnel metric down >20% week-over-week → investigate before changing anything else.
- Three consecutive weeks of missed commitments → stop and renegotiate the whole cadence honestly.

## Change log

- 2026-07-16 — v1 created.
