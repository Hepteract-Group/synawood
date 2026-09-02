# Module map (target)

```
core/creative/
  agent/           # harness: runTurn, system prompt builders
  tools/           # one module per Studio Tool (functional)
  project/         # Studio Project types, load/save, validate
  compositions/    # talking-head, slideshows, campaign stills, authored Root wrap
  motion-kit/      # first-party Remotion ads API (Wave 2M / ADR-0091)
  authored/        # allowlist compiler, iframe bundle — no secrets
  presets/         # ig_carousel_1080, tiktok_slideshow_9x16, …
  generators/      # image.ts, video-clip.ts, tts.ts, transcribe.ts adapters
  mcp/             # MCP server wrapping tools/ (after tools stable)
  render/          # Remotion Render Jobs
  generation-jobs/ # async Image/Video Generation Jobs (status, cost)
  billing/         # hosted plans, wallet debit/refund, spend gate wrap (ADR-0082)

products/{name}/
  brand-kit/
  product-marketing.md
  config.ts
  content/...

dashboard/
  app/(marketing-os)/studio/     # Studio routes
  app/api/studio/                # chat, project, render, approve

automations/
  creative-render.ts             # worker drain for Render Jobs (local + Fly)
  creative-extract.ts            # worker drain for extract jobs (local + Fly)
core/channels/
  publish-port.ts                # SchedulePostInput interface
  manual-publish.ts              # Phase 0–1
  postiz-publish.ts              # Postiz Public API adapter (Plan 29)
```

Persistence: Azure Blob client + Supabase schema under `core/creative/` (or `core/persistence/`) — see [storage-and-persistence.md](./storage-and-persistence.md). Local-first: [local-first.md](./local-first.md).

## Conventions

- Functional TypeScript only — no classes unless a framework forces it.
- Deep modules: callers import from folder entrypoints, not internals.
- Tests target tool + project seams first (pure), then harness with mocked model.
