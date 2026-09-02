# ADR-0089 — Product-scoped Extracts

**Status:** accepted  
**Date:** 2026-08-25  
**Epic:** [#1023](https://github.com/Hepteract-Group/marketing-os/issues/1023) · Docs task [#1024](https://github.com/Hepteract-Group/marketing-os/issues/1024)  
**Amends:** [ADR-0022](./0022-url-asset-ingest.md) (owned bytes, not hotlink), [ADR-0027](./0027-ad-generator-and-variants.md) / [ADR-0028](./0028-extract-vision-enrichment.md) (one-URL brief extract is not enough), [ADR-0044](./0044-brand-dna-and-catalog.md) (Extracts are not DNA or Catalog)

## Context

Paste-one-URL extract seeds a logo, one og:image still, a full-page screenshot, and an `ExtractedBrief`. Ads still lean on generated stock. Operators cannot see or reuse the screenshots across cuts. The founder asked for a Product-level store of public-site stills and copy that the agent can mix into slides and video.

Locked in grilling: Extracts persist on the **Product**, not a single Studio Project.

## Decision

### 1. Extracts are Product-owned media + copy

An **Extract** is a scored screenshot, downloaded still, or page-text snippet from a public URL, stored on the Product (Blob + Postgres). Any Studio Project for that Product may place or reference it.

Distinct from:

| Thing | Job |
|---|---|
| Brand DNA | Locked copy (tagline, ICP, claims) |
| Product Catalog | Offer SKUs / claim bounds |
| Library | Operator uploads + generated assets on a project |
| `ExtractedBrief` | One-shot messaging brief for Ad Generator apply |

Do not merge Extracts into DNA or Catalog. Do not hotlink remote URLs at render time (ADR-0022).

### 2. Public pages only

Crawl and screenshot only after `assertSafeFetchUrl` (and re-check the final URL). No cookies, no login walls, no private/link-local hosts. Skip pages that redirect to auth. Same fail-closed SSRF as URL extract.

### 3. Operator-visible in the Media bin

Media tab modes: **Library | Story | Extracts**. Extracts is a real tab of scored screenshots and text, not a chip or job log. The operator can open a still, see its source URL and quality score, and place it.

### 4. Quality score + mix

Each screenshot gets a quality score (usable / weak / reject). Rejected stills stay visible so the operator can override. The agent prefers high-score Extracts as `sourceImageAssetIds` / slide backgrounds instead of only generated stock. Generated media is still allowed to fill holes.

### 5. Generation Plan controls re-extract

When Generation Plan exists (#1008), the plan can list extra URLs to extract and a **re-extract this turn** flag. Default is reuse Product Extracts unless the operator asks to scrape again. Spend is estimate-before-generate (crawl + screenshots + vision score). Extract click / plan confirm is consent, same family as ADR-0028.

### 6. One extract worker, many artefacts

Keep `generation_jobs.role = extract`. The job may visit several public URLs in one run and persist many Extract rows. Do not add a second job role for “scrape.” Soft-fail a single bad page; do not fail the whole run.

## Rejected

- Per-project extracts that die with the cut.
- Scraping behind login.
- Treating og:image as the only brand still.
- Hiding screenshots on the extract job while the agent uses them silently.
- Auto-applying scraped copy onto locked DNA fields (ADR-0044 Apply stays explicit).
