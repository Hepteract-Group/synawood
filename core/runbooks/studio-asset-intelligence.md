# Runbook: Studio asset intelligence + Story Builder

**Purpose:** Index product media (probe → shots → keyframe thumbs → caption/tags → transcript → text + visual embeddings), search it by caption or appearance, run Analyze-on-index, and recover when indexing stalls — without scrubbing every clip by hand.
**Cadence:** As needed after uploads / imports; weekly sanity when building a content batch.
**Owner:** Founder (marketing operator).
**Time budget:** 2–5 minutes for upload→ready on a still; 5–15 minutes for a short video with caption/embed (needs Gateway key).
**Automation status:** partially automated — auto-index on upload; Media bin chip + Story mode + reindex/Retry + library backfill; worker optional for queue drain (local inline path works).

Contracts: [ADR-0032](../../docs/adr/0032-asset-intelligence.md), [ADR-0052](../../docs/adr/0052-visual-shot-embeddings.md), [ADR-0053](../../docs/adr/0053-analyze-on-index.md), [asset-intelligence](../../docs/architecture/asset-intelligence.md), [story-builder UX](../../docs/ux/story-builder.md). Plan 10 / epic [#162](https://github.com/Hepteract-Group/marketing-os/issues/162). Plan 26 / epic [#579](https://github.com/Hepteract-Group/marketing-os/issues/579).

## Inputs

- Local review: `npm run dev` in `dashboard/` → `http://localhost:3000` (or `npm run dev:review` → `http://127.0.0.1:3011`). Synawood Supabase — **never** the private example.
- Okiki: `http://localhost:3000/studio/projects/f146040a-e7a5-4d31-a938-63b6d94907bb`
- Migrations applied (`npx supabase db reset` or up-to-date local DB including `0020`–`0022`, `0028` shot match, `0040` `asset_analyses`).
- Azure Blob env for uploads (`AZURE_STORAGE_*`, `AZURE_BLOB_LOCAL_PREFIX=true` locally).
- For caption / visual embed / Whisper / analyze: `AI_GATEWAY_API_KEY` (or soft-skip when caps block paid stages). `MODEL_PROFILE=ci-stub` is £0 mocks.
- Face detect stays **off** unless you deliberately set `ASSET_FACE_DETECT=true` (privacy; no celebrity labeling).

## Steps

### A — Upload and watch the indexing chip

1. Open a Studio project → **Media** tab → **Library**.
2. Upload a still or short video. Done = file appears in the bin; persistent **Indexing…** chip shows while status is `pending`/`indexing` (not only a button label).
3. Reload the page while indexing. Done = chip still present (server poll via `GET /api/studio/assets/index-status`).
4. Wait until chip clears / assets show ready. Done = Story search can see captions/tags (or at least probe+shots+thumbs if paid stages soft-skipped).
5. Optional SQL: `select ordinal, thumb_blob_key is not null from asset_shots where asset_id = '<id>';` and `select kind from asset_embeddings where asset_id = '<id>';` — thumbs true; `text` and `visual` rows per shot when paid stages ran.

### B — Search by appearance (`find_moments`)

1. Two indexed shots with visual rows (a close-up and a wide). Captions can disagree with the picture.
2. Chat: **find moments for product close-up**. Thoughts → `find_moments` lists `shotId` + in/out. The close-up should rank first when visual rows exist.
3. `place_shot` still trims from that shot. If visual rows are missing, caption/tag hits still return (not a tool error).

### C — Analyze-on-index

1. Pick an indexed still with thumbs. Chat (ci-stub): ask `analyze_asset` with schema `{ "type": "object", "properties": { "summary": { "type": "string" } }, "required": ["summary"] }`.
2. Done = JSON in the tool result; SQL `select kind, schema_id, result from asset_analyses where asset_id = '<id>';` has one row. Re-run replaces that row.
3. HTTP (editor, signed in): `POST /api/studio/assets/<assetId>/analyze` with `{ "productId": "demo", "prompt": "Summarize the still", "schema": { … } }`. Viewer `GET …/analyze?productId=demo` lists the row.
4. Live profile with £>0 and no confirm spend: tool error or HTTP 402. Missing thumbs: “Keyframe thumbs missing. Retry index…”. Still call `inspect_preview` before finishing a make-video turn. Do not spend Seedance for this check.

### D — Backfill / Retry

1. Pre-2J videos with null thumbs: Media chip **Indexing library… N left** drains without Retry per file (`POST /api/studio/assets/index-missing`).
2. Failed visual API: chip lists the reason + **Retry** (`confirmSpend: true`).
3. Near cap: thumbs + text embeddings land; chip last_error says paid stages skipped and visual near spend cap. **Retry** with confirm spend to run caption + visual.

### E — Story Builder search and place

1. Media tab → **Story**.
2. Type a query (e.g. product noun from a caption) or pick a tag chip. Done = hit rows with caption/tags.
3. Open a hit → preview modal (shots seek on video). Done = Escape/backdrop closes modal; results remain.
4. **Place** on timeline or **Reference** (`@asset` into chat). Done = clip/token appears without leaving Studio.

### F — Chat / HTTP smoke (optional)

1. Chat: `find_assets` / `list_assets_by_tag` → same product-scoped hits as Story search.
2. `GET /api/studio/assets/search?productId=demo&q=product` → `{ hits }`.
3. `GET /api/studio/assets/<assetId>/index?productId=demo` → caption, tags, shots.

## Outputs

- `asset_index_state` rows at `ready` (or failed with `last_error`).
- `asset_shots` with `thumb_blob_key`; `asset_tags`; `asset_embeddings` `kind=text` and `kind=visual`.
- `asset_analyses` rows when Analyze ran.
- Timeline placements or chat `@asset` references from Story Builder.

## Escalation (troubleshoot)

| Symptom | What to do |
|---|---|
| Chip never appears after upload | Confirm local Supabase + Blob env; check browser network for upload / `index-status`. Upload path should enqueue inline index. |
| Stuck `indexing` forever | Check Next/server logs for probe/VLM errors; Retry. Ensure migrations `0020`–`0022` / `0028` / `0040` applied. |
| Ready but Story empty | Query may be too weak; try tag chip or filename keyword. Confirm `status=ready` and caption/tags exist. Semantic hits farther than distance 0.55 are dropped. |
| Appearance search ranks the wrong shot | Confirm `kind=visual` rows exist. Without them, caption/tag still work. Text and visual vectors are different spaces — never mixed by cosine. |
| “Keyframe thumbs missing” | Extract failed (ffmpeg/decode). Shot bounds still exist. Retry index. Visual embed and `analyze_asset` cannot run until thumbs exist. |
| “Paid index stages skipped” / visual near spend cap | Soft cap path — thumbs + text search ready; caption and visual need confirm. Retry with confirm spend or adjust `STUDIO_*_CAP_GBP`. |
| Analyze 402 / confirmSpend | Live VLM estimate > £0. Tick confirm spend in chat, or POST `confirmSpend: true`. ci-stub is £0. |
| Caption/embed never run | Need `AI_GATEWAY_API_KEY` (and spend confirm). `MODEL_PROFILE=ci-stub` uses mocks only. |
| Reindex 403 | Need editor role on the product; viewer can only GET search/status/analyze listing. |
| Face detect concern | Leave `ASSET_FACE_DETECT` unset/false. Even when true, stub sets `face_detect_ran` only — no identity/celebrity labels (ADR-0032). |
| Wrong Supabase / empty tables | You may be pointed at the private example or hosted by mistake — use `.env.local` local Synawood project. |

## Change log

- 2026-08-20 — Wave 2J closeout (#595): thumbs, visual retrieve, analyze, backfill, cost skip.
- 2026-08-20 — Keyframe thumbs on index (#580): Media bin chip shows extract failures; Retry re-extracts.
