# System boundaries

```
core/           product-agnostic capability
products/       fixture kits only in this public tree (`demo/`)
dashboard/      Next.js UI (pipeline, Creative Studio)
automations/    scheduled jobs — no silent magic
docs/           system design, architecture, UX/UI, ADRs
.agents/skills/ coding-agent skills — not Studio Tools
```

## Rules

- If it works for any product → `core/`.
- If it names a marketed product, ICP, or brand assets → store it on the Organization in the app. The public fixture is `products/demo/`.
- If a human must click or review → `dashboard/`.
- If it runs on a schedule without a human in the loop → `automations/`, and only after a Runbook proved the steps.
- Secrets never in git. Bring your own keys; see [self-host.md](../architecture/self-host.md).

Public clone vs private source of truth: [ADR-0079](../adr/0079-oss-path-a.md).

## SaaS identity

Public login, skippable user profile, Organization chrome, and Guides live in **`dashboard/`** plus **Supabase migrations**. They do **not** add an `organizations` table. See [saas.md](./saas.md) and [ADR-0068](../adr/0068-organization-is-product-tenancy.md).

## Creative Studio split

| Concern | Home |
|---|---|
| Agent loop, timeline model, Remotion, Generators | `core/creative/` |
| Fixture brand kit | `products/demo/brand-kit/` |
| Chat + player + timeline UI | `dashboard/` Studio routes |
| Async render / extract jobs | `automations/` locally; a worker process with Chromium for Playwright encode |
