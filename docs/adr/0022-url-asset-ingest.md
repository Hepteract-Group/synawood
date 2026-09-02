# ADR-0022 — URL asset ingest (no hotlink)

**Status:** accepted  
**Date:** 2026-08-16  
**Wave:** Creative factory foundation · Plan 08 · [#108](https://github.com/Hepteract-Group/marketing-os/issues/108)  
**Related:** ADR-0009 (Blob + Postgres), ADR-0015 (library recall), ADR-0028 (SSRF for extract)  
**Amended by [ADR-0089](./0089-product-extracts.md):** Product-scoped Extracts (scored public-site screenshots + text) are a separate store, shown in the Media bin Extracts tab. URL ingest into the project library stays images-only owned bytes as below.

## Context

Founders often have product stills on a CDN or landing page. Hotlinking those URLs into Remotion breaks when the remote host dies, rate-limits, or blocks render workers. Media bin already supports file upload; we need a URL path that still stores **owned bytes**.

## Decision

1. **Fetch server-side** with the extract SSRF gate (`assertSafeFetchUrl` / `fetchSafeBytes`).
2. **Persist to Blob** under the project uploads prefix; set `assets.source = 'url'` and record `probe.sourceUrl`.
3. **Images only** in v1 (JPEG/PNG/WebP/GIF). Video/audio URL ingest needs a later slice.
4. **UI:** Media bin **Add from URL** dialog; failures are visible (dialog + Studio banner).

## Consequences

- Migration extends `assets.source` check to include `url`.
- Render/export paths unchanged: they already resolve `blob_key`.
- Brand DNA URL page ingest (#106) remains a separate write to DNA, not the asset library.

## Rejected

- Storing only the remote URL on the asset and fetching at render time.
- Allowing private/local URLs for “convenience” in local dev (fail closed; use upload instead).
