# ADR-0045 — Effects Engine / first-party Style Packs

**Status:** accepted  
**Date:** 2026-08-17  
**Wave:** Vision 2E · Plan index **13** · Epic [#202](https://github.com/Hepteract-Group/marketing-os/issues/202)  
**Related:** ADR-0002 (Remotion), ADR-0006 (brand chrome), ADR-0010 (Approve), ADR-0018 (trust), ADR-0039 (marketplace packs), ADR-0041 (music)  
**Corrects:** Epic children cited ADR-0032 (asset intelligence) by mistake. **This ADR is the contract.**  
**Amended by:** [ADR-0058](./0058-filters-and-treatments.md) — Media bin **Filters** tab is the picker for these looks; Effects tab is clip **treatments**. `project.stylePackId`, pack JSON, `StylePackProvider`, and the license gate stay.
**Does not supersede:** ADR-0039 — marketplace `kind: style` artifacts stay installable recipes. v1 Effects packs are **first-party Remotion looks** in-repo.

## Context

Founders ask for “make it more cinematic / perfume-ad / VHS” without hiring a colorist. Wave 2E tickets [#203](https://github.com/Hepteract-Group/marketing-os/issues/203)–[#212](https://github.com/Hepteract-Group/marketing-os/issues/212) pointed at a missing `13-effects-engine.plan.md`.

## Decision

### 1. `project.stylePackId` is optional

Studio Project JSON may set `stylePackId` (`cinematic-teal-orange` | `luxury-perfume` | `vhs` | null). Empty = no grade. Path C logo/captions still apply on top (brand wins over pack tints).

### 2. First-party packs in `core/creative`

Pack JSON files under `core/creative/src/effects/packs/`: `id`, `label`, `license` (`first-party` for v1), CSS-grade tokens (`contrast`, `saturate`, `hueRotate`, `sepia`, `vignette`), `promptHints[]`, `musicHints[]`. Loader is a pure function that statically imports those files. No Blob fetch in v1.

### 3. Remotion `StylePackProvider`

Wrap talking-head (and slideshow when cheap) with a filter + vignette overlay. Pack must not hide Path C chrome.

### 4. Tools + Media bin Filters tab (amended)

`list_style_packs` / `set_style_pack`. HTTP under `/api/studio/projects/[id]/style-pack`. **Filters** tab lists packs and applies one to the cut (or to a clip — ADR-0058). Director free-text maps obvious phrases (`vhs`, `teal`, `perfume`) to a pack id without spend. Effects tab is treatments, not looks.

### 5. Approve license gate

v1 packs are `first-party` and always cleared. The gate still runs so a later third-party pack cannot Approve without a cleared license (same spirit as music ADR-0041).

### 6. Prompt / music hints

When a pack is active, Path A prompt block and music style hints append pack `promptHints` / `musicHints`. No silent generator call.

## Consequences

- Plan 13 slices [#203](https://github.com/Hepteract-Group/marketing-os/issues/203)–[#212](https://github.com/Hepteract-Group/marketing-os/issues/212) implement this contract.
- Marketplace style packs (ADR-0039) may later *reference* the same `stylePackId` values; they do not replace the Remotion provider.

## Rejected

- Shipping LUTs as binary blobs in v1.
- Letting a pack replace Path C logo/CTA.
- Paid third-party grades without a license row.
