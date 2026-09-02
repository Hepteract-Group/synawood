# ADR-0036 — Learning Agent (insights, never auto-apply)

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision 2F · Plan index **17** · Epic [#250](https://github.com/Hepteract-Group/marketing-os/issues/250)  
**Related:** ADR-0034 (structure snapshot), ADR-0035 (outcomes), ADR-0031 (workers, not in-loop multi-agent)  
**Corrects:** Epic [#250](https://github.com/Hepteract-Group/marketing-os/issues/250) children cited this ADR and plan 17 before the files existed. **This ADR is the contract.**

**Operator runbook:** [insights-review.md](../../core/runbooks/insights-review.md)

## Context

Manual outcomes and `creative_performance` exist. Founders still have to notice patterns (empty structure, missing CTA, long hooks) by eye. A Learning Agent can **propose** skill-pack prior updates. Auto-applying those priors would silently change every future cut.

## Decision

### 1. Insights are proposals, never mutations

A worker (on-demand in v1) reads `creative_performance` and writes `insights` rows. Status starts `open`. Apply / dismiss / snooze are **human** actions. Nothing in Studio Agent, Approve, or generators reads an insight until Apply writes priors.

### 2. Priors load local > product file > pack default

Canonical default: `core/creative/src/learning/priors.default.json`. Product overlay: `products/<id>/priors.json`. Operator override: `products/<id>/priors.local.json` (gitignored). Apply merges the insight's `proposedPrior` into the local file. Hosted cannot write git; Apply still records `applied` and stores the merged blob on the insight row.

### 3. Five analyses (v1)

| Kind | Trigger | Proposed prior |
|---|---|---|
| `empty_structure` | Finals with 0 beats and any views | `structure.requireBeats: true` |
| `missing_cta` | Finals with beats but no CTA, vs CTA present | `structure.requireCta: true` |
| `hook_length` | Hook beat longer than 3s on rows with views | `hooks.maxSeconds: 3` |
| `beat_count` | 1–2 beats underperforming vs 3–5 | `structure.preferredBeatCount: 4` |
| `offer_signups` | Offer beat present correlates with signups | `structure.requireOffer: true` |

Analyses are **pure functions** over performance rows. They do not call networks or LLMs in v1.

### 4. Insights UI is an operator list, not a vanity dashboard

`/insights` lists open insights with Apply / Dismiss / Snooze. `/insights/explore` shows Final rollup bars from `creative_performance`. An integrations bar on those pages links to Settings → Outcomes (token paste / stub pulls). No live OAuth.

### 5. Weekly digest is optional mail

`POST …/insights/digest` builds copy from open insights. Send only when `RESEND_API_KEY` and `INSIGHTS_DIGEST_TO` are set. Missing keys skip send; the preview still returns.

## Consequences

- Plan 17 slices [#251](https://github.com/Hepteract-Group/marketing-os/issues/251)–[#261](https://github.com/Hepteract-Group/marketing-os/issues/261) land schema, loader, analyses, worker, Apply, Insights UI, digest, tests, runbook.
- Studio Agent does not auto-run analyses mid-chat.

## Rejected

- Auto-applying priors when an insight is inserted.
- Calling an LLM to invent insights without performance rows.
- A separate multi-agent framework (ADR-0031).
