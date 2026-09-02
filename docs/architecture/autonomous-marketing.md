# Autonomous marketing

**Contract:** [ADR-0040](../adr/0040-autonomous-marketing.md) · [Plan 21](../../.cursor/plans/generated/21-autonomous-marketing.plan.md) · Epic [#297](https://github.com/Hepteract-Group/marketing-os/issues/297)

Goals decompose into plans and **human-gated** actions. Dispatch uses existing Studio Tools; no autonomous ad spend in v1.

## Surfaces

- `/goals` — list + create wizard
- `/goals/[id]` — progress, propose plan, approve/run, pause/kill, retrospective insight
- APIs under `/api/studio/goals/…`
- Studio tool `plan_campaign` + skill `marketing-strategist`

## Runbook

[campaign-goals.md](../../core/runbooks/campaign-goals.md)
