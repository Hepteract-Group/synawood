# Product Extracts

Contract: [ADR-0089](../adr/0089-product-extracts.md). Distinct from one-shot Ad Generator extract ([ad-generator-and-variants.md](./ad-generator-and-variants.md), [ADR-0028](../adr/0028-extract-vision-enrichment.md)) and from project library URL ingest ([asset-ingest.md](./asset-ingest.md), [ADR-0022](../adr/0022-url-asset-ingest.md)). Operator journey: [ux/product-extracts.md](../ux/product-extracts.md). Visual: [ui/product-extracts.md](../ui/product-extracts.md).

## Job

Store **public-site stills and copy on the Product** so every Studio Project can mix real brand pages into slides and video — not only generated stock.

## Domain

An **Extract** is a scored screenshot, downloaded still, or page-text snippet. Blob bytes + Postgres row. Product-scoped (`product_id`). Any Studio Project for that Product may place or reference it.

| Thing | Job |
|---|---|
| Brand DNA | Locked copy (tagline, ICP, claims) |
| Product Catalog | Offer SKUs / claim bounds |
| Library | Operator uploads + generated assets on a **project** |
| `ExtractedBrief` | One-shot messaging brief for Ad Generator apply |
| **Extract** | Reusable public-page stills + text on the **Product** |

Do not merge Extracts into DNA or Catalog. Scraped About-page text may *propose* DNA diffs; Apply stays explicit ([ADR-0044](../adr/0044-brand-dna-and-catalog.md)).

## Persistence (illustrative)

```ts
type ProductExtract = {
  id: string
  productId: string
  kind: 'screenshot' | 'still' | 'text'
  sourceUrl: string
  blobKey?: string
  text?: string
  quality: 'usable' | 'weak' | 'reject'
  qualityNote?: string
  jobId?: string
  createdAt: string
}
```

Remotion and Approve read **Blob keys**, never remote hotlinks (ADR-0022).

## Worker

Keep `generation_jobs.role = extract`. One job may visit several public URLs and persist many Extract rows. Soft-fail a **single** bad page; do not abort remaining URLs. If **no stills** land, mark the job **failed** with the skip/screenshot reason — an empty Extracts grid must not look ready.

Per starting URL: **hero (above the fold)**, then **viewport folds down the landing page** (scroll by ~80% of the viewport, even when the site wraps everything in one `<main>`), then **same-site nav/footer pages** until **10** stills total. Never persist one full-page strip as the only still. Drop first-fold duplicates. HTML fetch timeout is 30s. Public pages only — skip login walls.

Local and hosted drain: [studio-workers.md](./studio-workers.md) ([ADR-0094](../adr/0094-hosted-studio-workers-on-fly.md)). Capture runs Playwright in that worker, not on Vercel.

SSRF: `assertSafeFetchUrl` (and re-check the final URL). Public pages only. No cookies, no login walls, no private/link-local hosts. Skip redirects to auth.

Vision quality score after screenshot (usable / weak / reject). Rejected stills stay in the store so the operator can override.

## Agent + Generation Plan

The agent prefers high-score Extracts as `sourceImageAssetIds` / slide backgrounds. Generated media still fills holes.

When Generation Plan exists ([generation-plan.md](./generation-plan.md)):

- Optional extra URLs on the plan
- `reExtractThisTurn` flag (default **false** — reuse Product Extracts)
- Estimate-before-generate covers crawl + screenshots + vision score
- Extract click / plan confirm is spend consent (same family as ADR-0028)

## Module map (target)

| Path | Owns |
|---|---|
| `core/creative/src/extract/` | Crawl, screenshot, score, persist (extend; do not fork a second extract tree) |
| `supabase/migrations/` | `product_extracts` (name may vary; Product-scoped) |
| Media bin Extracts mode | Operator grid + place + delete |
| Studio Tools | List / place / enqueue extract on Product |

## Non-goals

- Per-project extracts that die with the cut
- Scraping behind login
- Hotlinking remote URLs at render time
- Treating og:image as the only brand still
- Auto-applying scraped copy onto locked DNA
