# AI Media

Contract: [ADR-0061](../adr/0061-ai-media-surface.md), [ADR-0062](../adr/0062-generated-asset-review.md).  
Epic: [#780](https://github.com/Hepteract-Group/marketing-os/issues/780). UX: [ai-media.md](../ux/ai-media.md).  
Plan: [28-ai-media.plan.md](../../.cursor/plans/generated/28-ai-media.plan.md).

## Why

Plan 06 needed an IA slot for slow generate work outside the editor. The stub stayed empty. Generation Jobs already live in Postgres (`generation_jobs`) and Blob (`assets`). The page should read them — not invent a second generate product.

## Map

| Thing | Owner |
|---|---|
| Enqueue / generate | Studio Tools on a Studio Project (ADR-0005) |
| Job rows + output preview | **AI Media** `/ai-media` |
| Tool traces / CostEvent | **Usage** `/usage` |
| Place on timeline / Approve | Studio |

## Data

Product-scoped `GET /api/studio/generation-jobs`. Fields already returned: `id`, `status`, `role`, `errorMessage`, `estimatedGbp`, `actualGbp`, `projectId`, `outputAssetId`, `createdAt`.

Review (ADR-0062) needs the output **asset** (kind, signed URL or blob read the dashboard already uses for the Media bin). Do not add a new job table.

## Guardrails

- Reload polls jobs. In-flight → banner (ux-first).
- No prompt composer on this route.
- Brand binding stays on generate (ADR-0006), not re-decided here.
- CI stays `MODEL_PROFILE=mock`; Retry that spends asks first.
