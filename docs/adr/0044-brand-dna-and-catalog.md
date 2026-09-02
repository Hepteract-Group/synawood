# ADR-0044 — Brand DNA + Product Catalog

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Creative factory foundation · Epic [#97](https://github.com/Hepteract-Group/marketing-os/issues/97)  
**Related:** ADR-0006 (brand-bound generation), ADR-0018 (trust), ADR-0022 (URL ingest), ADR-0025 (per-project brand)  
**Corrects:** Epic children cited a missing ADR-0020. **This ADR is the contract** for [#104](https://github.com/Hepteract-Group/marketing-os/issues/104)–[#107](https://github.com/Hepteract-Group/marketing-os/issues/107).  
**Does not supersede:** ADR-0025 — Studio still reads `project.brand`. DNA/catalog live on the **Product**, not the timeline.  
**Amended by [ADR-0089](./0089-product-extracts.md):** Extracts are not DNA and not Catalog. Scraped About-page text may *propose* DNA diffs; Apply stays explicit.

## Context

Path A prompts need more than colors and mood: tagline, ICP, values, and what the product may claim. Campaign packs need a **Catalog** of ingredients (offer SKUs / proof bounds) distinct from the Media bin. URL page ingest should propose DNA diffs, never silent-overwrite locked fields.

Disk kits under `products/<id>/brand-kit/` remain the git-canonical seed. Hosted edits need a Postgres cache because Vercel cannot write the repo.

## Decision

### 1. Brand DNA is product-scoped copy, not chrome

Canonical file: `products/<id>/brand-kit/dna.json`. Cache column: `products.brand_dna` (jsonb). GET returns cache if present, else the file seed. PATCH upserts the cache (and writes the file in local dev when the kit path is writable).

Fields: `tagline`, `values[]`, `icp`, `offer`, `proofPoints[]`, `business { legalName, category, url, locale }`, `lockedFields[]`.

`BrandPromptContext` includes DNA tagline / ICP / values / forbidden-adjacent proof so generators see them (Path A). Path C chrome is unchanged.

### 2. URL ingest is a draft, Apply is explicit

`POST …/brand/dna/ingest` SSRF-fetches a public page (reuse `fetchSafeBytes` + ADR-0022 host rules), extracts title / meta description / canonical URL into a **draft**. UI diffs draft vs current DNA. Apply copies only selected unlocked fields. Locked fields never change on re-ingest. Draft is a persistent banner until Apply or Discard (ux-first).

### 3. Product Catalog is not the Asset Library

Canonical file: `products/<id>/catalog/catalog.json`. Cache: `products.catalog` (jsonb). Items: `id`, `name`, `summary`, `claimBounds[]`, `forbiddenClaims[]`. CRUD via `/api/products/[id]/catalog`. Delete removes the live item; historical campaign pack snapshots are not rewritten (document in the runbook).

Campaign ingredient pickers read Catalog, not Media bin assets.

### 4. Auth

Editor+ may GET. Owner (or editor) may PATCH DNA, Apply ingest, and mutate Catalog. No silent spend.

## Consequences

- Slices [#104](https://github.com/Hepteract-Group/marketing-os/issues/104)–[#107](https://github.com/Hepteract-Group/marketing-os/issues/107) implement this contract.
- ADR-0032 “Brand DNA parked” is lifted for this epic only; Campaign factory remaining work stays on epic #97 / #98.

## Rejected

- Storing DNA only in chat / `product-marketing.md` with no schema.
- Auto-applying URL ingest onto locked legal/ICP fields.
- Merging Catalog into `assets` (different job: claims vs media).
