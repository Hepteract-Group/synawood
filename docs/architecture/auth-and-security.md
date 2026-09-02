# Auth and security (Studio / dashboard)

Lean guardrails — enough to not leak media or burn budget; not an enterprise IdP project.

## Auth (v1 → Plan 07)

- Historical v1: dashboard **founder/operator only** with a simple Supabase Auth gate.
- **Plan 07 / ADR-0024:** multi-**Product** membership (`owner` | `editor` | `viewer`), public **waitlist** landing, **allowlisted** signup/login until we open access. See [product-auth.md](./product-auth.md) and [auth-and-onboarding.md](../ux/auth-and-onboarding.md).
- Protect `/(app)/*` and product APIs: unauthenticated → 401/redirect. No anonymous generation.
- the private example is a Product someone creates — not the identity of Synawood.

## Secrets

- Never commit `.env`, connection strings, Azure keys, model API keys.
- Local: `.env.local`. Deploy: Vercel env. Document names in `.env.example`.
- Prefer Azure managed identity later; connection string OK for solo v1 if rotated and scoped.

## Azure Blob

- Private containers; **short-lived signed URLs** for Player/download (minutes, not days).
- Separate **dev** vs **prod** prefix or account.
- App never lists the whole account; scoped to `marketing-os/{productId}/…`.
- CLI (`az`) for bootstrap/debug on developer machines only — not called from production request handlers.

## Supabase

- **Dedicated** Synawood project — never the private example’s DB.
- Enable **RLS** on all app tables before exposing any anon key to a browser.
- Service role key: server-only (API routes / workers). Never ship to the client.
- Free-plan awareness: size/egress limits; purge killed drafts periodically.

## AI / cost

- Server-side only for model API keys.
- Estimate-before-generate + monthly/weekly caps ([pricing-and-cost.md](./pricing-and-cost.md)). Hosted: prepaid wallet + trial video block ([billing.md](./billing.md)).
- Ask before enabling paid spend in new environments (see `AGENTS.md`).

## Agent / prompt

- Studio Agent cannot run shell or arbitrary network tools.
- Allowlisted Studio Tools only. Authored Remotion TSX compiles in the **sandbox** ([ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)) — not as Node in the worker.
- Do not put secrets in system prompts or Marketing skills.
- Approve/Publish remain human.

## Authored compositions

Agent-written Remotion runs in Chromium, never in the worker process.

- **Compiler:** isolated webpack. Allowlist: `remotion`, `@remotion/*`, `@synawood/creative/motion-kit`. No env `DefinePlugin`. No Node builtins. No import of blob/Supabase/dashboard modules.
- **Player:** isolated iframe (no `allow-same-origin` / no parent cookies). Props via `postMessage` (signed asset URLs, brand, `motionSeed`).
- **Renderer:** same bundle. Chromium may fetch signed project assets only; block arbitrary outbound hosts.
- Signed URLs in props are time-limited and asset-scoped. They are not the storage account key.

See [authored-compositions.md](./authored-compositions.md).

## Content safety (light)

- Brand claim rules via marketing skills + product-marketing.md.
- No auto-publish.
- Log model ids + prompts metadata for dispute/debug (retain policy TBD; avoid storing unnecessary PII — founder face video is intentional product data).
