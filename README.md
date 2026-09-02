# Synawood

Type a brief. Play the ad.

Synawood is a go-to-market operating system with Creative Studio at the center: a chat-to-timeline editor that produces talking-head cuts and motion-graphics ads you would otherwise hire an editor to make. Brand lives on an Organization you create in the app. This repository is the Apache-2.0 core. You run it on your machines, with your keys.

## Stand it up

You need **Node 22+** and **Docker Desktop** (or Engine + Compose). About ten minutes if Docker is already running.

```bash
git clone https://github.com/Hepteract-Group/synawood.git
cd synawood
npm ci
cp .env.example .env
cp .env.example dashboard/.env.local
npm run local:up
```

`local:up` starts local Postgres/Auth, the dashboard, encode/extract workers, and an optional scheduler. When it prints success:

| Surface | URL |
|---|---|
| Studio | http://localhost:3000 |
| Database studio | http://localhost:54343 |

1. Open Studio and create an account (local Auth allows any email unless you set an allowlist).
2. Create an Organization. Import brand from a URL, or use the demo fixture.
3. Open **Studio** → **Create project**.

Stop the stack with `npm run local:down`.

Env files take **names** from `.env.example`. Paste the local Supabase URL and keys `supabase start` printed if the dashboard cannot sign you in. Never commit values. Full notes: [Self-host](docs/architecture/self-host.md).

## From brief to ad

Studio is one loop. Chat describes the ad. The Player is the picture. Export encodes what you see.

```
Brief  →  Studio Agent  →  Player  →  Approve  →  Export
```

1. Create a project. Choose **Footage** if you have video, or **Motion graphics** if the agent should author the picture in Remotion.
2. In chat, write one paragraph: who it is for, the one idea, and the proof. Send.
3. Hit **Play**. Authored motion lives in the Player, not as a baked clip on timeline MAIN. Footage you upload does sit on MAIN.
4. Ask for voiceover or music when you want audio. Those land on timeline audio tracks.
5. **Export** encodes the Player. That needs the worker container, not the Next.js process alone.

Model keys live in env (image, video, speech, chat). Empty keys fail closed. Generating video clips spends whatever your provider charges. The agent must not claim it added voice, music, or faster motion unless those tools actually ran.

Detail: [Studio Agent harness](docs/architecture/agent-harness.md), [video generation](docs/architecture/video-generation.md).

## What this repo is

| Path | Role |
|---|---|
| `dashboard/` | Next.js UI: pipeline, Studio chat, Player, timeline |
| `core/creative/` | Agent, timeline model, Remotion, generators |
| `core/runbooks/` | Product-agnostic procedures |
| `products/demo/` | Fixture kit so Studio boots without a customer brand |
| `automations/` | Scheduled jobs after a runbook proved the steps |
| `supabase/migrations/` | Schema. Apply the same numbered files wherever you host Postgres |
| `docs/` | System design, architecture, ADRs |

Customer ICP, claims, and brand kit are Organization data in the app. They are not a marketed pack in git.

## Commands

| Command | Purpose |
|---|---|
| `npm run local:up` | Full local stack (recommended) |
| `npm run local:down` | Stop it |
| `npm run dev` | Dashboard only, on the host (no workers) |
| `npm run test` | Vitest |
| `npm run typecheck` | TypeScript across workspaces |
| `npm run build` | Next production build |

`npm run dev` is fine for reading the UI. Extract stills and Remotion encode need the Docker workers.

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). Pull requests on this repository are welcome. Do not commit secrets.
