# Architecture index

Technical design for Synawood and Creative Studio. Prefer these over chat history.

| Doc | Covers |
|---|---|
| [overview.md](./overview.md) | Component map |
| [module-map.md](./module-map.md) | Target folders and ownership |
| [agent-harness.md](./agent-harness.md) | Studio Agent structure — framework vs APIs |
| [studio-tools.md](./studio-tools.md) | Tool catalogue and contracts |
| [timeline-model.md](./timeline-model.md) | Studio Project schema concepts |
| [render-pipeline.md](./render-pipeline.md) | Remotion preview + async export |
| [generators.md](./generators.md) | Image, video clip, TTS, transcription — generate then assemble |
| [ai-media.md](./ai-media.md) | `/ai-media` Generation Job + asset review (ADR-0061 / 0062) |
| [video-generation.md](./video-generation.md) | Exact video path: AI clips vs Remotion Final assets |
| [model-registry.md](./model-registry.md) | Pick-and-choose Model Profiles via AI SDK |
| [gateway-catalog.md](./gateway-catalog.md) | Family adapters, freeze/remap, catalogue data (ADR-0084 / 0085 / 0093) |
| [generation-plan.md](./generation-plan.md) | Generation Plan + Artefacts pane (ADR-0086) |
| [pricing-and-cost.md](./pricing-and-cost.md) | Budgets, ledger, estimate-before-generate |
| [billing.md](./billing.md) | Hosted Stripe wallet, entitlements, trial video block (ADR-0082) |
| [marketing-skills.md](./marketing-skills.md) | GTM skills for Studio Agent (≠ engineering skills) |
| [brand-in-media.md](./brand-in-media.md) | Per-project brand + Paths A/B/C (ADR-0025) |
| [slideshow-infographics.md](./slideshow-infographics.md) | IG/TikTok carousel + vertical slideshow format |
| [authored-compositions.md](./authored-compositions.md) | Agent-authored Remotion TSX, sandbox, motion kit (Wave **2M** / ADR-0091) |
| [creative-constitution.md](./creative-constitution.md) | Wave **2N** marketing harness: constitution, skill packs, ChatGPT epic map (ADR-0092) |
| [campaign-packs.md](./campaign-packs.md) | Campaign pack stills + Path C chrome (ADR-0021) |
| [still-to-motion.md](./still-to-motion.md) | Animate still → motionAssetId (ADR-0023) |
| [ad-generator-and-variants.md](./ad-generator-and-variants.md) | URL/PDF → ExtractedBrief → variant matrix (Wave 2B) |
| [product-extracts.md](./product-extracts.md) | Product Extracts — scored public-site stills + Media bin tab (ADR-0089) |
| [studio-workers.md](./studio-workers.md) | Extract + render workers: local spawn, hosted Fly (ADR-0094) |
| [intent-and-scenes.md](./intent-and-scenes.md) | Intent + Scene tree on Studio Project (Wave 2A) · [Runbook](../../core/runbooks/intent-scenes-director.md) |
| [ai-director.md](./ai-director.md) | Preview-first `direct_project` / DirectorPlan · [Runbook](../../core/runbooks/intent-scenes-director.md) |
| [contextual-clip-suggestions.md](./contextual-clip-suggestions.md) | Per-clip / per-scene suggestion drawer · [Runbook](../../core/runbooks/intent-scenes-director.md) |
| [vision-roadmap.md](./vision-roadmap.md) | Vision waves 2A–2N index |
| [overlay-library.md](./overlay-library.md) | Text, Captions, Stickers, Filters, Effects (Wave 2K) |
| [editor-agent-polish.md](./editor-agent-polish.md) | Wave **2L** talking-head tools, first-pass policy, vetoes |
| [../competitive/](../competitive/) | OpusClip + Descript vs Studio Agent — gap + settled vetoes |
| [broll-assembly.md](./broll-assembly.md) | Library-first B-roll plan (`assemble_broll`) · ADR-0047 · [Runbook](../../core/runbooks/broll-assembly.md) |
| [version-tree.md](./version-tree.md) | Named branches within a Studio Project (Wave 2D / ADR-0030) |
| [mcp-surface.md](./mcp-surface.md) | Same tools over MCP |
| [storage-and-persistence.md](./storage-and-persistence.md) | Azure Blob + Supabase — media and history |
| [azure-blob-bootstrap.md](./azure-blob-bootstrap.md) | `az` CLI container create / smoke |
| [local-first.md](./local-first.md) | Localhost review before Vercel |
| [vercel-deploy.md](./vercel-deploy.md) | Vercel project setup; Production from `main` only |
| [ci-cd.md](./ci-cd.md) | MR checks pipeline + post-merge Vercel deploy |
| [auth-and-security.md](./auth-and-security.md) | Secrets, Blob/DB/AI guardrails; auth overview |
| [product-auth.md](./product-auth.md) | Multi-Product membership, allowlist, waitlist (ADR-0024) — current |
| [saas-identity.md](./saas-identity.md) | SaaS target: access mode, profiles, org setup, Guide engine (ADR-0067–0069) |
| [public-api-v1.md](./public-api-v1.md) | `/api/v1` first-party Studio Tools, keys, idempotency, webhooks (ADR-0038) · [reference](../api/v1/) |
| [distribution-and-postiz.md](./distribution-and-postiz.md) | Approve → paste URL and/or Postiz Schedule (Plan 29 / ADR-0063) |
| [data-flow.md](./data-flow.md) | End-to-end generate → Approve → distribute |
| [design-review-2026-07-18.md](./design-review-2026-07-18.md) | Gaps, risks, mitigations, guardrails |
| [stack.md](./stack.md) | Committed libraries and hosts |
| [../pwa/](../pwa/) | Installable PWA, online-only (ADR-0078) — no service worker |

ADRs: [docs/adr/](../adr/).
