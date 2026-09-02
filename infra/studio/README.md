# Local Docker stack (ADR-0094 / #1368)

Founder QA runs **in Docker**, not as `npm run dev` on the Mac. One network: `synawood`.

| Service | URL |
|---|---|
| Studio dashboard | http://localhost:3000 |
| Supabase Studio | http://localhost:54343 |
| Postiz | http://localhost:4007 |

Hosted Vercel / Fly / hosted Supabase are a different world. This compose never points at them.

## Start

From repo root, with Docker running:

```bash
npm run local:up
```

That:

1. Creates Docker network `synawood`
2. Starts local Supabase **on that network** (`supabase start --network-id synawood`)
3. Starts Postiz (own Postgres/Redis — not Synawood’s)
4. Starts Studio dashboard + extract/render workers

Workers poll queued extract and render jobs. Dashboard has `STUDIO_EXTRACT_INLINE=false` so Next does not spawn a Mac worker.

## Stop

```bash
npm run local:down
```

## Env

Repo-root `.env` and `dashboard/.env.local` (gitignored) are mounted. Use **local** Supabase keys from `npx supabase status`, not production.

Postiz needs `infra/postiz/.env` with `JWT_SECRET`. `local:up` writes a throwaway one if missing.
