# Synawood

An in-house, systemized go-to-market engine. Product-agnostic core. Customer brand lives on the Organization in the app (`products/demo/` is the fixture kit).

This is not a collection of scripts. It is a structured system designed so that one
future hire can read the runbooks, open the dashboard, and start executing on day one.

## Operating principles

1. **Manual first, then automate.** Every process starts as a runbook executed by hand.
   Only after 2–3 manual runs do we automate the painful steps. The runbook remains as
   the documentation of what the automation does.
2. **One-hire operability.** Everything must be executable by a single marketing hire
   with no tribal knowledge: runbooks describe the *how*, the dashboard shows the
   *what and when*, and `products/{name}/` holds the *for whom*.
3. **Reusable core.** Anything product-agnostic lives in `core/`. Product-specific
   strategy, config, and content live in `products/{name}/`. Onboarding a new product =
   copy a product folder, rewrite `product-marketing.md` and `config.ts`.
4. **Accountability is part of the system.** Commitments become Google Calendar events
   with completion signals. Missed commitments escalate — reminder, nag, red flag in the
   weekly review. Nothing silently disappears.
5. **Funnel metrics only.** We report qualified visit → activation → signup → paid
   → retained. Followers and reach are diagnostics, never KPIs. Product-specific
   stage names live in that Product’s context folder, not here.

## Structure

```
core/
  runbooks/      # product-agnostic procedures (one file per process)
  channels/      # adapters: social, email, blog, ads
  analytics/     # KPI collectors (PostHog, GA4, Stripe, Search Console)
  calendar/      # Google Calendar accountability integration
  creative/      # Creative Studio (planned): agent, timeline, Remotion, generators
  marketing-skills/ # GTM craft packages for Studio Agent
products/
  demo/          # fixture kit + generic governance so Studio boots without a customer brand
dashboard/       # Next.js app (Vercel): funnel KPIs, content pipeline, Studio, task board
automations/     # scheduled jobs (Vercel cron)
docs/            # system design, architecture, UX/UI, ADRs
.agents/skills/  # project-level engineering skills (mattpocock/skills)
```

Agents: read [`AGENTS.md`](./AGENTS.md) and [`CONTEXT.md`](./CONTEXT.md). Design index: [`docs/README.md`](./docs/README.md).

## Stack decisions

| Decision | Choice | Notes |
|---|---|---|
| Repo | Dedicated repo (this one) | Reusability across products |
| Dashboard + crons | Vercel | Same account as the private example (`hosted-vercel-team`) |
| Product analytics | PostHog (free tier) | Dual-write from the private example's existing `trackEvent` layer |
| Social scheduling | Postiz, self-hosted on Fly.io | Plan 29 — paste-URL always; adapter + Work board Schedule |
| Email sequences | Resend + code | the private example already sends via server |
| SEO monitoring | Google Search Console API | Free; paid tools only if data demands it |
| Workflow automation | Vercel cron + TypeScript | No n8n unless a non-technical hire needs it |
| Creative Studio agent | Vercel AI SDK tool loop | Thin harness — see `docs/architecture/agent-harness.md` |
| Model selection | Model Profiles (pick per role) | `docs/architecture/model-registry.md` |
| Image / video Generators | AI SDK generateImage + generateVideo | Assets into Studio Project — `docs/architecture/video-generation.md` |
| Assemble / export | Remotion 4 (+ FFmpeg helpers) | Composes generated + uploaded assets into Final assets |
| Media storage | Azure Blob Storage | App SDK + env; ops via Azure CLI — `docs/architecture/storage-and-persistence.md` |
| Metadata DB | Supabase Postgres | Dedicated Synawood project (not the private example) |
| Local development | localhost before Vercel | `docs/architecture/local-first.md` |
| Generator cost | Ledger + caps vs product budgets | `docs/architecture/pricing-and-cost.md` |
| Marketing skills | `core/marketing-skills/` | Studio Agent craft — ≠ `.agents/skills/` |
| Distribution | Paste URL + Postiz Schedule (Plan 29) | `docs/architecture/distribution-and-postiz.md` |

## Phases

- **Phase 0 (now):** context doc, GTM one-pager, baselines, first runbooks, calendar loop.
- **Phase 1:** fix the funnel — tracking audit, CRO pass, tool landing pages. No paid spend yet.
- **Phase 2:** Google Search ads + SEO/content engine + founder content cadence. Postiz adapter is Plan 29 / ADR-0063 (does not wait on ads spend).
- **Phase 3:** retargeting, optimization, kill/scale decisions, day-90 review.

## Local development (Plan 00+)

Local-first: review on localhost before any Vercel deploy. See [`docs/architecture/local-first.md`](docs/architecture/local-first.md).

```bash
npm install
npx supabase start                    # local Postgres+Auth (Docker); applies migrations
cp .env.example .env                  # repo root — used by workers/smoke scripts
cp .env.example dashboard/.env.local  # Next.js app env (same values)
npm run dev                           # http://localhost:3000
```

Fill both env files with the **local** Supabase values printed by `supabase start`
(`API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`) and `SUPABASE_PROJECT_REF=marketing-os`.
Azure Blob can stay on the shared account — local writes are isolated under the
`local/` prefix. This stack runs on the `5434x` port range (Studio UI at
`http://127.0.0.1:54343`) so it coexists with other local Supabase projects.
Create an operator to sign in:

```bash
npx supabase start   # note API_URL + keys, then:
curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@marketing-os.local","password":"<pick-one>","email_confirm":true}'
```

### Studio preview + agent + local export (Plans 01–02)

1. Sign in at `/login`, open `/studio`, create a `talking_head_60` project.
2. Upload an MP4 — preview uses Remotion Player (no encode).
3. With `MODEL_PROFILE=founder-edit` and API keys set, chat e.g. `add captions "Edit PDFs without Adobe"` —
   tool call → project mutation → Player/timeline update → tool trace (no paid key).
4. Click **Export**, then in another terminal:

```bash
npm run render:local -- --job <render_job_uuid>
```

5. Confirm `render_jobs.status = completed` and play the signed output URL from
   `GET /api/studio/render/<jobId>`.

Render prerequisites: Node ≥22, Remotion’s Chromium deps (`npx remotion browser ensure` if needed). Encoding stays on your machine — not Vercel serverless. Chat rollback: `STUDIO_CHAT_API=false`.

Useful commands:

| Command | Purpose |
|---|---|
| `npm run typecheck` | TypeScript across workspaces |
| `npm run lint` | ESLint / tsc |
| `npm run test` | Vitest (no full encode in CI) |
| `npm run build` | Next production build |
| `npm run smoke:blob` | Azure Blob put/get/delete under `local/` prefix |
| `npm run smoke` | Post-deploy smoke: `/api/health`, Studio auth gate, `/login` |
| `npm run render:local -- --job <id>` | Local Remotion encode worker |

Azure container bootstrap via `az`: [`docs/architecture/azure-blob-bootstrap.md`](docs/architecture/azure-blob-bootstrap.md).

Supabase: locally, `npx supabase start` applies everything under [`supabase/migrations/`](supabase/migrations/) automatically. For a hosted **Synawood** project (never the private example), apply the same migrations via `supabase db push`.

### Local vs hosted env

Local files (`.env`, `dashboard/.env.local`) point at **local** Supabase and are gitignored. Hosted values live in **Vercel → Settings → Environment Variables**; keep a gitignored `.env.production.local` mirror for local production-build smoke (`npm run build -w dashboard && npm run start -w dashboard`). Which file loads when, and the Vercel workflow, is documented in [`.cursor/rules/env-and-deploy.mdc`](.cursor/rules/env-and-deploy.mdc) and [`docs/architecture/local-first.md`](docs/architecture/local-first.md). Template: [`.env.production.example`](.env.production.example).

## Conventions

- Functional TypeScript only — no classes.
- Runbooks follow `core/runbooks/RUNBOOK-TEMPLATE.md`.
- Secrets live in `.env.local` / Vercel env vars, never in this repo.
