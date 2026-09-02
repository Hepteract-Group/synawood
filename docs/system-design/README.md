# System design index

Product-level design for Synawood as an operating system — not implementation details.

| Doc | Covers |
|---|---|
| [overview.md](./overview.md) | What the system is and is not |
| [operating-model.md](./operating-model.md) | Manual-first, phases, parallel tracks |
| [boundaries.md](./boundaries.md) | core / products / dashboard / automations |
| [content-pipeline.md](./content-pipeline.md) | Brief → Draft pack → Final asset → published |
| [creative-studio.md](./creative-studio.md) | Studio as a first-class GTM capability (marketing team, ADR-0070). Motion-graphics authorship (ADR-0091). Creative constitution (ADR-0092). Plan before paid generate (ADR-0086). Product Extracts (ADR-0089) |
| [saas.md](./saas.md) | Public signup, skippable profile, organization = Product row, Guides |
| [billing.md](./billing.md) | Hosted wallet, plans, trial spend gates, first Approve path (ADR-0082 / 0083) |
| [success-and-kill-rules.md](./success-and-kill-rules.md) | How we know Studio is working |
| [Open source](../opensource/README.md) | Path A: private SoT + Apache-2.0 public core ([ADR-0079](../adr/0079-oss-path-a.md)) |
| Public API | First-party Studio Tools over HTTP — [architecture/public-api-v1.md](../architecture/public-api-v1.md) ([ADR-0038](../adr/0038-public-api-v1.md)). No separate system-design file (infra + Settings console). |
