# Timeline model (Studio Project)

See [ADR-0003](../adr/0003-project-json-source-of-truth.md).

## Conceptual schema

- **project** — id, productId, compositionId, fps, width, height, durationFrames, status
  - `durationFrames` is **project-owned and dynamic** (ADR-0014): initialised from the composition preset, adjusted as content changes. Compositions render to it; the preset only supplies fps/width/height defaults.
  - Optional **compositionSource** (`source`, `motionSeed`, compile error) when `compositionId === 'authored'` ([ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)).
- **brand** — resolved project brand slice (`BrandPromptContext` + logo/still/font asset ids) after Brand Studio or `import_product_brand`
- **tracks[]** — id, type (`video` \| `audio` \| `caption` \| `overlay`), order
- **clips[]** — id, trackId, assetId, from, durationInFrames, trim. Optional `filterId` / `filterIntensity` (grade) and `treatments[]` (ADR-0058). Whole-cut grade remains `project.stylePackId` (ADR-0045).
- **overlays[]** — hook title, end card, lower thirds, free **title**, **captions**, **stickers** (ADR-0057). Typed props from brand tokens, not free HTML. Layout is 0–1 of the frame. `end_card` anchors to the last clip end + `END_CARD_GAP_FRAMES`, clamped to the composition tail. Not the same as picture Overlay / PiP (ADR-0046).
- **assets[]** — id, kind, uri, probe metadata, `source` (`upload` \| `brand_kit` \| `generator`)
- **revision** — monotonic int for optimistic UI / undo later

`generate_*` tools refuse if `project.brand` is missing (no auto-attach). See [brand-in-media.md](./brand-in-media.md) and [ADR-0025](../adr/0025-per-project-brand.md).

## Composition binding

`compositionId` selects a Remotion composition (`talking-head-60`, `social-carousel`, `vertical-slideshow`, …) **or** a project-owned authored composition ([ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)). Remotion rejects `_` in composition ids — use hyphens. Legacy `talking_head_60` is normalized on load. Unknown first-party composition → reject. Authored TSX compiles in a sandbox (allowlisted imports, no Node, Path C wrap). Chat is not the source of truth.

Slideshow / carousel projects also carry `slides[]` + preset — see [slideshow-infographics.md](./slideshow-infographics.md).

Ad Generator projects may carry `project.brief` (ExtractedBrief) and, for variants, DB columns `parent_project_id` + `variant_spec` — see [ad-generator-and-variants.md](./ad-generator-and-variants.md) and [ADR-0027](../adr/0027-ad-generator-and-variants.md).

## Persistence

- **Supabase Postgres:** `studio_projects` (timeline JSON or jsonb), status, revision, profile.
- **Azure Blob:** raw media; project JSON references `asset` ids → `blob_key` only.
- See [storage-and-persistence.md](./storage-and-persistence.md).
