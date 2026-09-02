# Generation Plan (UX)

Paid generate is preview-first. Operator sees and edits the plan, confirms £, then clips exist. Contract: [ADR-0086](../adr/0086-generation-plan-and-artefacts.md). Visual: [ui/generation-plan.md](../ui/generation-plan.md). Not Director preview ([intent-panel.md](./intent-panel.md)).

## Flow (cannot miss)

1. Operator: “make a 60s ad” (video gen on, £>0).
2. **Modal:** Generation Plan (goal, tone, scenes, **dialogue**, models, **£ total**, optional extra extract URLs + **Re-extract this turn**). Minimize allowed.
3. If they close it: **persistent banner** — “Plan ready — confirm to generate.” Reload still shows banner (poll project).
4. They edit fields in the modal or Artefacts pane.
5. **Confirm spend** on the plan total (wallet when hosted).
6. Generate jobs run; existing generate modal + banner apply.
7. Chat: after Apply, a make-an-ad turn that never calls generate is the ADR-0055 error — not “here is the plan” as success.

Video off: skip this flow. Director “make it premium”: DirectorPlan, not this panel.

## Copy

- Spoken lines: **Dialogue** / **Voiceover**, never Script.
- Primary: **Confirm spend and generate**. Secondary: Save draft / Discard plan.
- £ is tabular, en-GB. Breakdown expandable per scene.

## Empty / error

- Draft with £0 and no scenes: cannot confirm; say what is missing.
- Frozen video id on the plan: block confirm; point at catalogue.
- Local worker missing: banner (same as generate).
