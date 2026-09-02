# Brand DNA and Product Catalog

Operator runbook for product-scoped copy (ADR-0044). Not the Asset Library.

## Where it lives

- Seed files: `products/<id>/brand-kit/dna.json` and `products/<id>/catalog/catalog.json`
- Hosted cache: `products.brand_dna` and `products.catalog` (jsonb)
- UI: `/settings/brand`

Editor+ can read. Editor+ can patch DNA, apply URL ingest, and mutate Catalog.

## URL ingest

1. Paste a public https URL.
2. A **draft banner** appears (survives reload until Apply or Discard).
3. Tick unlocked fields only, then Apply. Locked fields never change on ingest.

## Catalog vs Media bin

Catalog items are claim bounds (what we may say about an offer). Media bin assets are footage/stills. Campaign ingredient pickers must read Catalog.

Deleting a Catalog item removes it from the live list. Historical campaign pack snapshots are **not** rewritten.
