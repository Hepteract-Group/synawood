# Runbook: Analytics connect

**Purpose:** Record creative outcomes and store provider tokens so Final rollup and Insights have numbers.
**Cadence:** After each publish, or whenever a platform number is worth attaching to a Final.
**Owner:** Founder (marketing operator).
**Time budget:** 2 minutes per outcome; 3 minutes to paste a token or start OAuth.
**Automation status:** Settings Outcomes form + encrypted token paste + OAuth Connect (fails closed without app ids) + pull worker (stubs until live adapters are approved).

Contracts: [ADR-0035](../../docs/adr/0035-performance-ingestion.md), plan 16 / epic [#237](https://github.com/Hepteract-Group/marketing-os/issues/237). Insights bar: [#247](https://github.com/Hepteract-Group/marketing-os/issues/247). Worker: [#245](https://github.com/Hepteract-Group/marketing-os/issues/245). OAuth UI: [#246](https://github.com/Hepteract-Group/marketing-os/issues/246).

## Inputs

- Local review: `npm run dev:review` → `http://127.0.0.1:3011`
- Apply migrations `0033_performance_ingestion.sql`, `0034_refresh_performance_search_path.sql`, and `0042_performance_pull_oauth.sql` on local Synawood Postgres
- `PERFORMANCE_TOKEN_KEY` (64 hex chars) before any token paste or OAuth
- Optional OAuth app ids (`TIKTOK_CLIENT_ID` / `_SECRET`, `META_*`, `YOUTUBE_*`, `LINKEDIN_*`, `SHOPIFY_*`, `STRIPE_*`)
- Optional `CRON_SECRET` for `/api/cron/performance-pull`
- A posted URL that already exists on a publish record, **or** a Final id

## Steps

### A — Record a metric

1. Open **Settings → Outcomes**.
2. Pick Views, Clicks, Signups, or Revenue. Enter the number.
3. Paste the posted URL **or** the Final id from `/content/finals/{id}`. Save outcome.
4. Done = attributed row under Recent outcomes, or an unattributed notice if neither matches.

### B — Connect a provider

1. Same page, Connections. If the OAuth app ids are set, click **Connect**. Otherwise paste a token and Save token.
2. Done = the provider shows connected. The token field clears; it is never shown again.
3. **Disconnect** clears the stored secret.

### C — Run the pull worker

1. Click **Run pull worker**, or `curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3011/api/cron/performance-pull`.
2. Done = last-pull reason on each connection (`not_connected` or `stub_provider`). No live TikTok/Meta rows in v1.

### D — Confirm Insights can see connections

1. Open **Insights**. The integrations bar lists saved connections and links back here.
2. Done = bar copy matches Outcomes (connected count, or "No analytics connections yet").

## Outputs

- `outcomes` / `unattributed_activity` rows
- Encrypted `integration_secrets` (never plaintext)
- `integrations.last_pull_*` stamps
- `creative_performance` rollup after `refresh_creative_performance()`

## Escalation

| Symptom | What to do |
|---|---|
| Token paste / OAuth locked | Set `PERFORMANCE_TOKEN_KEY` in local env; do not store tokens in git. |
| Connect returns 400 | Provider `*_CLIENT_ID` / `*_SECRET` unset — paste a token instead. |
| Unattributed activity | Check the posted URL matches exactly, or paste the Final id. Do not invent a Final id. |
| Rollup empty | Approve a cut, record an outcome against its URL or Final id, then refresh the view. |
| Live TikTok/Meta/Shopify numbers | Stop. Adapters stay stub until a spend/scopes ADR. Worker still records `stub_provider`. |

## Change log

- 2026-08-22 — Worker (#245), OAuth Connect UI (#246), Final-id field (#242).
- 2026-08-17 — First version for plan 16 closeout (#248).
