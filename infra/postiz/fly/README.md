# Fly deploy for Postiz (#1136)

Production URL (until custom DNS): **https://mos-postiz.fly.dev**

## Prerequisites

- `fly auth login`
- `infra/postiz/.env.fly` — copy from `.env.fly.example`; map Cloudflare R2 keys from `dashboard/.env.local`:
  - `CLOUDFLARE_ACCESS_KEY` → same name
  - `CLOUDFLARE_SECRET_KEY` → **`CLOUDFLARE_SECRET_ACCESS_KEY`**
  - `CLOUDFLARE_API_TOKEN` is Wrangler/MCP only — not used by Postiz

## One-shot deploy

```bash
./infra/postiz/fly/deploy.sh
```

## Fly apps (hepteract-group)

| App | Role |
|-----|------|
| `mos-postiz` | Postiz UI/API |
| `mos-postiz-pg` | Managed Postgres (Postiz data) |
| `mos-postiz-redis` | Redis container |
| `mos-postiz-temporal` | Temporal server (`BIND_ON_IP=::0`, gRPC 7233) |
| `mos-postiz-temporal-pg-mpg` | Managed Postgres (Temporal metadata). Use **direct.** host, not pgbouncer. |
| `mos-postiz-temporal-es` | Unused (`ENABLE_ES=false`). Leave stopped. |
| `mos-postiz-temporal-pg` | Unused container PG. Leave stopped. |

## After deploy

1. Open https://mos-postiz.fly.dev — sign up, mint Public API key in Settings.
2. Set Vercel (Production + Preview):
   - `POSTIZ_ADAPTER=live`
   - `POSTIZ_BASE_URL=https://mos-postiz.fly.dev/api/public/v1`
   - `POSTIZ_API_KEY=<key from step 1>`
3. Smoke: `curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: $POSTIZ_API_KEY" https://mos-postiz.fly.dev/api/public/v1/integrations` → `200`

## Known fixes applied

- Fly MPG `DATABASE_URL` needs `?sslmode=require` for Prisma (deploy script / manual patch).
- Temporal Postgres uses MPG **direct** (`direct.<cluster-id>.flympg.net`), not `pgbouncer.*` (prepared statements) and not the raw `mos-postiz-temporal-pg` container.
- Temporal must bind IPv6 (`BIND_ON_IP=::0` so ringpop also gets a broadcast address). Fly `.internal` is 6PN IPv6; IPv4-only listen makes Postiz signup 502.
- Login on `*.fly.dev` needs the cookie-domain patch in `Dockerfile` (tldts would set `Domain=.fly.dev`, which browsers reject). Do not create a second account if sign-up refreshed once — the user already exists. Sign **In**.

## Custom domain (later)

Yes, the URL can change. Keep the same Fly app. When `postiz.synawood.com` DNS is ready:

1. `fly certs add postiz.synawood.com -a mos-postiz`
2. Point the DNS CNAME at `mos-postiz.fly.dev` (or the A/AAAA Fly shows)
3. `fly secrets set -a mos-postiz MAIN_URL=https://postiz.synawood.com FRONTEND_URL=https://postiz.synawood.com NEXT_PUBLIC_BACKEND_URL=https://postiz.synawood.com/api`
4. Vercel Production + Preview: `POSTIZ_BASE_URL=https://postiz.synawood.com/api/public/v1` (same API key)
5. Existing Postiz users and the API key stay. OAuth apps (X / LinkedIn / TikTok) must use the new callback URL.
