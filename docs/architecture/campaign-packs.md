# Campaign packs

Plan 09 / ADR-0021. Square still creatives with Path C chrome, separate from Slideshow.

## Project shape

- `compositionId`: `campaign-pack-still`
- `campaignPack.brief` — prompt, aspect, optional `suggestionSource`
- `campaignPack.creatives[]` — headline/body/cta, `backgroundAssetId`, optional `motionAssetId` (#113)

Never store campaign creatives in `slides[]`.

## Render

Local render maps the first creative (or a selected id) through `toCampaignPackStillProps` and prefers still output as primary.

## Later slices

| Issue | Scope |
|---|---|
| #110 | Brief + batch generate tools/API — **done** (`set_campaign_brief`, `generate_campaign_creatives`, `/campaign/brief`, `/campaign/generate`) |
| #111 | Campaigns home + detail UI — **done** (`/campaigns`, pack detail grid, Approve selected) |
| #112 | Marketing skills in harness |
| #113 | Still-to-motion Animate — **done** (`/campaign/animate`, modal + banner) |
| #114 | Pack Approve multi-Final — **done** (per-creative Final + publish_record) |

## Tools / API (#110)

| Surface | Behaviour |
|---|---|
| `set_campaign_brief` | Persist prompt, aspect, productId, imageAssetIds |
| `plan_campaign_creatives` / `set_campaign_creative` | Outline + per-card edits (no spend) |
| `generate_campaign_creatives` | Estimate (`estimateOnly`) → `confirmSpend` when £>0 → N stills + CostEvents via image jobs |
| `POST …/campaign/brief` | HTTP twin for brief save |
| `POST …/campaign/generate` | HTTP twin for batch estimate/generate |
