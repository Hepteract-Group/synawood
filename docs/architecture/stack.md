# Stack

| Layer | Choice |
|---|---|
| Dashboard | Next.js — **local-first**, then Vercel (`hosted-vercel-team`) |
| Language | TypeScript, functional only |
| Studio Agent | Vercel AI SDK tool loop (`streamText` + tools) |
| Model selection | **Model Profiles** — pick reasoner/image/video/speech/STT ([model-registry.md](./model-registry.md)) |
| Image / video APIs | AI SDK `generateImage` + `experimental_generateVideo` (Gateway or providers) |
| TTS / captions | Profile-selected speech + transcribe (or ElevenLabs/Whisper adapters) |
| Assemble / preview / export | Remotion 4 (+ FFmpeg helpers); local encode before cloud worker |
| Studio workers (extract + render) | Local `extract:local` / `render:local`; hosted **Fly app** (not Vercel, not Postiz) — [studio-workers.md](./studio-workers.md), [ADR-0094](../adr/0094-hosted-studio-workers-on-fly.md) |
| Media binaries | **Azure Blob Storage** (app SDK + env; ops via **Azure CLI**) |
| Metadata / history | **Supabase Postgres** (dedicated Synawood project; free plan OK initially) |
| Auth (v1) | Operator-only gate — see [auth-and-security.md](./auth-and-security.md) |
| Cost control | Cost ledger + caps vs product budgets ([pricing-and-cost.md](./pricing-and-cost.md)) |
| Marketing skills | `core/marketing-skills/` (+ product overlays) for Studio Agent |
| Engineering skills | `.agents/skills/` from mattpocock/skills (coding agents only) |
| Publish | Manual paste-URL + DB `publish_records` (always) |
| Scheduling | Postiz on Fly via `core/channels` adapter (Plan 29 / ADR-0063) |
| Analytics | PostHog (+ GA4 / Stripe collectors later) |
| Automations | Local scripts first; Vercel cron when deployed |
| CI | GitHub Actions MR checks (mocked generators, no prod secrets) — [ci-cd.md](./ci-cd.md) |
| CD | Vercel Production on `main` (auto); Preview manual/opt-in — [vercel-deploy.md](./vercel-deploy.md) |

Secrets: `.env.local` locally; Vercel/Fly env in deploy — never in git. See [local-first.md](./local-first.md).
