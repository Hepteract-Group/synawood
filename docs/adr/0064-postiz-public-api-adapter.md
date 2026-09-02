# ADR-0064 — Live Postiz adapter: Public API, hosting, organic channels

**Status:** accepted  
**Date:** 2026-08-22  
**Amended:** 2026-08-26 — mock is **CI/pipeline tests only**. Founders, `npm run dev`, and Vercel never see mock keys, mock accounts, or mock Postiz behaviour. Missing live config is an empty/error state, not demo data.  
**Plan:** **29** · Epic [#787](https://github.com/Hepteract-Group/marketing-os/issues/787)  
**Related:** ADR-0063 (in scope), ADR-0065 (Schedule UX + posted URL)  
**Docs:** [Postiz Public API](https://docs.postiz.com/public-api/introduction)

## Context

Synawood already has `PublishAdapter` (`schedule` / `getStatus`) in `core/channels`. Studio and the dashboard must talk to that port, never a Postiz SDK in `'use client'` files.

Postiz’s Public API is the same on Cloud (`https://api.postiz.com/public/v1`) and self-host (`https://{domain}/api/public/v1`). Auth is an API key (or `pos_…` OAuth token) in `Authorization`. Create-post is rate-limited (~90/hour self-host, `API_LIMIT`). Inlining media as base64 hits **413**.

Postiz calls a connected social account an **integration**. Synawood already has a `channel` enum that mixes organic and ads.

## Decision

### 1. Implement the existing port in `core/channels`

`createPostizPublishAdapter` becomes a real HTTP client (functional `fetch`, no dashboard SDK). Add **`cancel`** to `PublishAdapter` (DELETE `/posts/{id}`; treat 404 already-deleted as success → Synawood `skipped`).

Callers: Next API routes on the Work board. Not the Studio Agent.

### 2. Credentials and base URL

| Env name | Purpose |
|---|---|
| `POSTIZ_BASE_URL` | Public API root (Cloud or self-host). No trailing-path surprises. |
| `POSTIZ_API_KEY` | `Authorization` header. Fail closed if the live adapter is selected and this is missing. |
| `POSTIZ_WEBHOOK_SECRET` | Optional; used when webhook ingest lands (ADR-0065). |

Names only in `.env.example` / `.env.production.example`. Fail-closed runtime when the live adapter is selected is [#795](https://github.com/Hepteract-Group/marketing-os/issues/795). Never commit values. Never log the key.

**Mock is restricted to pipeline tests.** `POSTIZ_ADAPTER=mock` and fixture integrations exist only in Vitest / GitHub Actions. Settings, Work board, local founder review, and Vercel always use the live adapter against a real instance, or show the empty/error copy from [schedule-and-publish.md](../ux/schedule-and-publish.md). Never ship “Founder X” demo rows or placeholder keys to a human.

v1 is **our instance + one API key**. Do not build Postiz OAuth-for-other-customers.

### 3. Hosting

Self-host on **Fly** is the production default. Local smoke may use the bundled Docker map (`localhost:4007`) against a **real** local Postiz. CI **never** calls a live instance ([#803](https://github.com/Hepteract-Group/marketing-os/issues/803), [#812](https://github.com/Hepteract-Group/marketing-os/issues/812)). CI uses the mock adapter and fixtures only — that path must not leak into the dashboard UI.

Operator runbook: [postiz-hosting.md](../../core/runbooks/postiz-hosting.md) ([#796](https://github.com/Hepteract-Group/marketing-os/issues/796)).

### 4. Channel map — organic only in v1

Synawood stores `(product_id, channel, postiz_integration_id)` — table working name `product_channel_integrations` ([#797](https://github.com/Hepteract-Group/marketing-os/issues/797)). No social passwords.

| Synawood `channel` | Postiz `settings.__type` (v1) |
|---|---|
| `x_founder` | `x` |
| `linkedin_founder` | `linkedin` or `linkedin-page` (chosen in Settings) |
| `tiktok_organic` | `tiktok` |

**Reject** (loud error, stay on manual / other tools): `google_search_ads`, `meta_retargeting`, `linkedin_ads`, `apple_search_ads`, `blog_seo`, `email_onboarding`.

Instagram / YouTube / Threads are a later map, not v1.

Settings binds Synawood channel → GET `/integrations` picker ([#798](https://github.com/Hepteract-Group/marketing-os/issues/798)). Unmapped channel is a UI state (ADR-0065), not a 500 with no copy.

### 5. Media: Blob SDK → multipart `/upload`

Synawood **server** reads the Final from Azure Blob (SDK) and POSTs multipart to `/public/v1/upload`. Pass returned `{ id, path }` in the create-post `image` array.

Do **not** rely on `/upload-from-url` in v1 for Blob SAS URLs: they expire, and Postiz SSRF-safe fetch rejects localhost (local-first would fail). Do **not** base64-inline (413).

### 6. Create post

`POST /posts` with `type: schedule` (needs `date`) or `type: now`. One Synawood schedule call = one Final × one mapped channel. Persist `postiz_id` on `publish_records` (unique index already exists). If `postiz_id` is already set, do not create a second Postiz post.

Create-post rate limit: do not burst; surface 429 as a recoverable failed schedule.

### 7. Synawood owns `publish_records`

Postiz is the scheduler. Status and live URL land back on the Synawood row (ADR-0065). Week board and metrics never query Postiz as source of truth.

## Rejected

- Postiz Node SDK in the dashboard client bundle.
- Storing Twitter/LinkedIn/TikTok passwords in Supabase.
- Routing ads spend through Postiz.
- upload-from-url as the only media path.
- Treating a missing API key as a soft no-op (that was the stub). Missing config is fail-closed + visible (ADR-0065).
