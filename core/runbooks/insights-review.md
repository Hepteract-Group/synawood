# Runbook: Insights review

**Purpose:** Review Learning proposals from Final rollup, apply priors by hand, and optionally mail a digest. Nothing auto-applies.
**Cadence:** Weekly, or after a batch of outcomes is recorded.
**Owner:** Founder (marketing operator).
**Time budget:** 5–10 minutes.
**Automation status:** partially automated — on-demand analyses + optional digest mail; Apply is always human.

Contracts: [ADR-0036](../../docs/adr/0036-learning-agent.md), plan 17 / epic [#250](https://github.com/Hepteract-Group/marketing-os/issues/250).

## Inputs

- Local review: `npm run dev:review` → `http://127.0.0.1:3011`
- Apply migrations `0033`–`0035` on local Synawood Postgres
- At least one Final with recorded outcomes (Settings → Outcomes)
- Optional digest: `RESEND_API_KEY` and `INSIGHTS_DIGEST_TO`

## Steps

### A — Run analyses

1. Open **Insights**.
2. Click **Run analyses**. A banner says "Running analyses…" until the worker finishes.
3. Done = Open list shows new proposals, or a notice that nothing new matched.

### B — Apply, snooze, or dismiss

1. Read the body. Apply writes `products/<id>/priors.local.json` locally (gitignored).
2. Hosted Apply still marks the row applied and stores the merged priors on the insight. It cannot write git.
3. Snooze hides it for 7 days. Dismiss hides it for good.
4. Done = row leaves Open. Studio does not change until a later session loads priors.

### C — Explore rollup

1. Insights → **Explore**.
2. Bars are real `creative_performance` views. Empty = record outcomes first.
3. Integrations bar → Settings → Outcomes if a token is missing.

### D — Digest (optional)

1. Insights → **Email digest**.
2. Without `INSIGHTS_DIGEST_TO`, you get a preview notice and no send. That is success.
3. Done = mail arrives, or the skip notice.

## Outputs

- `insights` rows (`open` / `applied` / `dismissed` / `snoozed`)
- Local overlay `products/<id>/priors.local.json` after Apply (dev)
- Optional Resend email

## Escalation

| Symptom | What to do |
|---|---|
| Insights table unavailable | Apply migration `0035_insights.sql`. Do not `supabase db reset`. |
| No new insights | Record outcomes, then run analyses again. Analyses never call an LLM. |
| Priors file missing on Vercel | Expected. Trust the applied row blob until a git-backed overlay exists. |
| Want auto-apply | Stop. ADR-0036 forbids it. |

## Change log

- 2026-08-17 — First version for plan 17 (#261).
