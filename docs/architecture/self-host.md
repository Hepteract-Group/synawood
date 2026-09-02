# Self-host Synawood

This public tree is meant to run **on your machines**, with **your** keys. It is not wired to Hepteract hosted services.

## What you need

- Node 22+
- Docker (for the local stack: dashboard, workers, Postgres, optional scheduler UI)
- API keys for any model you want Studio to call (image, video, speech, chat). Empty keys mean those tools fail closed.

Copy key **names** from `.env.example` and `dashboard/.env.example` if present. Never commit values.

## Local stack (recommended)

From the repo root:

```bash
npm ci
npm run local:up
```

Then open:

- Dashboard / Studio: `http://localhost:3000`
- Local Postgres / Studio (Supabase CLI): port `54341` API, `54343` studio UI, if you started that stack

Stop with `npm run local:down`.

`local:up` should fail if the dashboard container is not listening on port 3000. If it printed success and the page does not load, check `docker compose logs dashboard`.

## Mac-native Next (optional)

`npm run dev` in this repo starts the dashboard on the host. That path is fine for reading code. The supported full stack (extract / encode workers + scheduler on one network) is Docker.

## Bring-your-own backing services

| Concern | You provide |
|---|---|
| Auth + Postgres | Local Supabase CLI, or your own Supabase project, or compatible Postgres + GoTrue |
| Media blobs | Azure Blob (SDK + env) or a compatible local prefix |
| Models | Provider keys in env. Mock adapters are for tests, not a hosted product |
| Social scheduling | Optional. Paste-URL always works. A live scheduler is a separate adapter |

Do not point a public fork’s GitHub Actions at someone else’s Vercel team or production database.

## Workers

Extract (Chromium stills) and Remotion encode need a worker process with Playwright / Chromium — not serverless. Locally that is the `workers` compose service. Hosted, run an equivalent image you control.

## License and contributions

Apache-2.0. File issues on the private source of truth if you have access; otherwise a public issue is a request, not a commit bit. Coding agents must not push this public remote. See the root `AGENTS.md`.
