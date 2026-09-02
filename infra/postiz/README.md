# Local Postiz (Plan 29)

Official upstream stack vendored for Synawood local dev. **Not** the Synawood Supabase database.

## Start

```bash
cd infra/postiz
cp .env.example .env   # once — set POSTIZ_JWT_SECRET (openssl rand -hex 32)
docker compose up -d
```

UI: http://localhost:4007  
Public API: http://localhost:4007/api/public/v1

Point Synawood at it (`dashboard/.env.local` + root `.env`):

```
POSTIZ_ADAPTER=live
POSTIZ_BASE_URL=http://localhost:4007/api/public/v1
POSTIZ_API_KEY=<from Postiz Settings → Public API>
```

Operator runbook: [`core/runbooks/postiz-hosting.md`](../../core/runbooks/postiz-hosting.md).

## Chrome “Request Header Or Cookie Too Large” on localhost:4007

`localhost` shares one cookie jar across every dev port (Synawood on :3000, Supabase auth, Postiz JWT, etc.). Chrome can exceed nginx’s header limit; Cursor’s browser starts clean.

**Fix:** Chrome → Settings → Privacy → Third-party cookies → See all site data → search `localhost` → Remove. Or DevTools → Application → Cookies → `http://localhost` → clear. Incognito also works.

## Stack (separate from Synawood)

Postiz runs its **own** Postgres, Redis, and Temporal (Postgres + Elasticsearch). Do not point it at the Synawood Supabase project — different app, different schema, and Temporal is required for scheduling.

Upstream reference: [gitroomhq/postiz-docker-compose](https://github.com/gitroomhq/postiz-docker-compose).
