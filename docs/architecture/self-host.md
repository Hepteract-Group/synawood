# Self-host Synawood

You run this tree on **your** machines, with **your** keys. Nothing here is wired to a hosted dashboard you do not control.

## What you need

- Node 22+
- Docker (dashboard, workers, Postgres, optional scheduler)
- API keys for any model Studio should call (image, video, speech, chat). Empty keys fail closed.

Copy key **names** from `.env.example`. Never commit values.

## Local stack

From the repo root:

```bash
npm ci
cp .env.example .env
cp .env.example dashboard/.env.local
npm run local:up
```

Then open http://localhost:3000. Database UI: http://localhost:54343.

`local:up` should fail if the dashboard is not listening on port 3000. If it printed success and the page does not load, run `docker compose logs dashboard`.

Stop with `npm run local:down`.

If sign-in fails, paste the local Supabase URL, anon key, and service role into both env files. `npx supabase status` prints them. Keep `AZURE_BLOB_LOCAL_PREFIX=true` so blob writes stay under `local/`.

## First ad

1. Create an Organization. Import brand from a product URL, or continue with the demo kit.
2. Studio → Create project. **Footage** or **Motion graphics**.
3. Chat: audience, one idea, proof. Send.
4. Play. Export when the Player is the ad you want.

Encode and URL-extract need the `workers` compose service (Chromium). `npm run dev` on the host does not start them.

## Host-only Next (optional)

`npm run dev` starts the dashboard on the host. Use it to read UI. The supported full stack is Docker.

## Bring your own backing services

| Concern | You provide |
|---|---|
| Auth + Postgres | Local Supabase CLI, or your own Postgres + GoTrue |
| Media blobs | Azure Blob (SDK + env) or a local prefix |
| Models | Provider keys in env. Mock adapters are for tests |
| Social scheduling | Optional. Paste-URL always works |

Do not point GitHub Actions at someone else’s Vercel team or production database.

## License

Apache-2.0. See the root `README.md`.
