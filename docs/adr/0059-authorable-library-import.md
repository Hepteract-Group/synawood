# ADR-0059 — Author and import stickers, filters, and effects

**Status:** accepted  
**Date:** 2026-08-22  
**Wave:** Vision **2K** · Plan index **27** · Epic [#692](https://github.com/Hepteract-Group/marketing-os/issues/692)  
**Related:** ADR-0057 (place overlays), ADR-0058 (grades / treatments), ADR-0018 (no silent spend), ADR-0005 (generated media), ADR-0009 (Blob + Postgres), ADR-0039 (marketplace packs later), ADR-0041 / 0045 (license gates)  
**Amended by [ADR-0091](./0091-empowered-agent-authored-compositions.md):** licensed Lottie and Remotion TSX are **Composition source** (and licensed Lottie files as motion assets), not this sticker/filter/effect author path. Agent-written GLSL shaders stay out.  
**Does not supersede:** ADR-0039. Signed marketplace zip packs remain the *distribution* path for third-party catalogs. This ADR is **product-local library** + import + agent authoring.

## The product

Pre-built packs are not enough. The founder will want a **the private example badge**, a **warmer look**, or a **harder punch** that is not in the repo. The Studio Agent (or a simple import) must be able to **create** stickers, filters, and treatments and then apply them like first-party ones.

Users should **import from elsewhere** when the file is honest and license-clearable. We do not import CapCut drafts or After Effects projects as the Studio document (we author in Remotion). That is “we are the editor,” not a feature-fear. Licensed Lottie JSON is in-scope as a motion asset ([ADR-0091](./0091-empowered-agent-authored-compositions.md)).

## Decision

### 1. Product library vs first-party pack

| Source | Where it lives | License |
|---|---|---|
| **First-party** | In-repo JSON + static assets (like ADR-0045 packs, sticker PNGs) | Always `first-party` / Approve-cleared |
| **Product library** | `studio_library_items` + Blob | `generated` or `imported`; Approve needs a cleared row |

A library item: `id`, `productId`, `kind` (`sticker` \| `filter` \| `effect` \| `text_preset` \| `caption_preset`), `label`, `source`, `licenseStatus`, `recipe` (jsonb), optional `blobKey`, `createdBy` (`user` \| `agent` \| `import`).

First-party items **do not** require a DB row to list. Library items are per product (the private example vs a future product).

### 2. How the agent creates (compose, do not compile)

The agent **never** writes shaders into the project. Remotion TSX lives in **Composition source**. Licensed Lottie is a motion asset on the Product library ([ADR-0091](./0091-empowered-agent-authored-compositions.md)). Neither is this library-item path.

| Kind | Create path | Spend |
|---|---|---|
| **Sticker** | `create_library_item` kind=sticker → `generate_image` with transparency + brand refs → persist PNG/WebP in Blob, QC alpha | Confirm if £>0; persistent generation banner |
| **Filter** | Agent proposes **grade tokens** in the same shape as style packs (contrast, saturate, hueRotate, sepia, vignette, hints). Founder confirms. Saved as `recipe`. | Token proposal is reasoner (confirm if £>0). No silent. |
| **Effect** | Agent proposes a **stack of v1 primitives** from ADR-0058 (`shake` + `glow`, intensities). Saved as `recipe: { steps: [...] }`. | Reasoner confirm if £>0. Cannot add a primitive that is not allowlisted. |
| **Text / caption preset** | Named style (`presetId` + tokens). No generator required. | Free |

Tool: `create_library_item`. After create, `place_sticker` / `apply_filter` / `apply_effect` use the new id like a first-party id.

If the founder says “make a sticker of our logo with a circle,” the agent uses **brand logo** as a ref (ADR-0006), not a guessed mark.

### 3. How the founder creates without chat

Media bin, per tab: **New…**

- Stickers: upload PNG/WebP with alpha, or “Generate…” (same job path as the agent).
- Filters: “Save current look as…” (snapshot of sliders) or import (below).
- Effects: “Save this stack…” from the inspector (selected clip’s treatments).

Same mutations as the agent. No second database.

### 4. Import from elsewhere

| File | Kind | v1 |
|---|---|---|
| PNG, WebP, SVG (no script/foreignObject) | Sticker | **Yes** — existing upload / add-from-URL (ADR-0022). SVG sanitized; reject script. |
| GIF / APNG | Sticker | **No** (animated stickers = later). Show a clear error. |
| JSON matching grade schema | Filter | **Yes** |
| `.cube` LUT | Filter | **Yes (v1.1 / #720)** — parse 3D IRIDAS table (size 2–32); Remotion applies SVG curves sampled from the cube. Same license gate as other imported filters. |
| JSON treatment recipe (primitives only) | Effect | **Yes** — unknown primitive id rejected |
| CapCut / Premiere / AE project | — | **No** |
| Lottie JSON | Motion asset | **Yes** — Product library + composition source ([ADR-0091](./0091-empowered-agent-authored-compositions.md)); license gate. Not a GIPHY sticker. |
| Font files | Text | **No** as overlay import; fonts stay Brand kit |

Imported items start `licenseStatus: unknown`. Approve **fails closed** until the founder checks **I have the right to use this commercially** (same pattern as voice consent / music license). Agent cannot tick that box.

URL import reuses add-from-URL. Persist under `library/{productId}/{kind}/…`. Do not use the private example Blob prefixes.

### 5. Marketplace (later)

ADR-0039 `kind: style` packs may **install** into this library (copy recipe + assets). Billing stays deferred. This ADR does not build the marketplace UI.

### 6. Trust and UX

- No silent generate (ADR-0018). Banner + modal while a sticker renders; poll `generation_jobs`.
- Created items appear in the bin **after** the job is ready (reload-safe), not only in chat Thoughts.
- QC: stickers fail if fully opaque full-frame (would cover the ad). Filters fail if tokens out of schema range.

## Rejected

- Letting the agent emit Remotion component source as an “effect.”
- Importing other NLEs’ project files.
- Shared global library across products (leaks the private example assets into a future product).
- Auto-Approve of imported packs.

## Consequences

- Migration `studio_library_items` + license column (or reuse a generic license table).
- Tools + HTTP for list/create/import/place.
- Runbook: when to generate vs import vs use first-party.
