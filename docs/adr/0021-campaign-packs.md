# ADR-0021 — Campaign packs (still creatives)

**Status:** accepted  
**Date:** 2026-08-16  
**Wave:** Plan 09 · Epic [#98](https://github.com/Hepteract-Group/marketing-os/issues/98)  
**Related:** ADR-0013 (slideshow — do not reuse `slides[]`), ADR-0006 (brand-bound generation), [#109](https://github.com/Hepteract-Group/marketing-os/issues/109)

## Context

Campaign packs need a brief → many Path C stills → Approve path, separate from Video Suite and Slideshow.

## Decision

1. Composition id `campaign-pack-still` (1080×1080, 1 frame).
2. Project JSON carries `campaignPack: { brief, creatives[] }` — **not** `slides[]`.
3. Path C chrome via existing `SlideFrame` / brand tokens.
4. DNA / Catalog suggestions are optional fields; packs work without DNA while that track is deferred.

## Consequences

- Create/load via `createEmptyProject({ compositionId: 'campaign-pack-still' })`.
- Batch generate, Campaigns UI, Animate, multi-Final Approve are later slices (#110–#114).

## Rejected

- Reusing slideshow `slides[]` for campaign creatives.
- Hotlinked remote images as creative backgrounds (Blob only).
