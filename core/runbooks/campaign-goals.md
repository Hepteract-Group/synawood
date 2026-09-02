# Runbook — Campaign goals (autonomous marketing)

**Related:** [autonomous-marketing.md](../../docs/architecture/autonomous-marketing.md) · ADR-0040 · Plan 21

## When

You want a durable goal with human-gated steps (no silent spend).

## Local steps

1. Apply migrations: `npx supabase db reset` (includes `0025_campaign_goals.sql`).
2. `npm run dev:review` → http://127.0.0.1:3011/goals
3. **New goal** → title + success metric → Create.
4. On the goal page: **Propose plan** (creates awaiting_approval actions + one `noop_verify`).
5. **Approve + run** on `noop_verify` (or Approve then Run).
6. Progress banner updates via retrospective; **Pause** / **Kill** stop further dispatch.

## Studio Agent path

With `marketing-strategist` skill selected, call tool `plan_campaign` with `goalId`.

## Out of scope

Paid ads (#306) stay blocked until a paid-ads ADR exists.
