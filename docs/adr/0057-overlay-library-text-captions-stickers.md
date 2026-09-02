# ADR-0057 — Overlay library: Text, Captions, Stickers

**Status:** accepted  
**Date:** 2026-08-22  
**Wave:** Vision **2K** · Plan index **27** · Epic [#692](https://github.com/Hepteract-Group/marketing-os/issues/692)  
**Related:** ADR-0001 (tools), ADR-0003 (project JSON), ADR-0016 (Media bin tabs), ADR-0006 / 0025 (brand chrome), ADR-0042 (claim scan), ADR-0049 (ad = video + music + brand)  
**Amended by [ADR-0075](./0075-word-timed-captions.md):** karaoke, keyword highlights, and licensed auto emoji are in scope now.  
**Does not supersede:** ADR-0016 (tabs stay). ADR-0045 (looks / grades). Complements [ADR-0058](./0058-filters-and-treatments.md) and [ADR-0059](./0059-authorable-library-import.md).

## The product

The operator (and the Studio Agent) must be able to put **words and graphics on the picture** the same way they put clips on the timeline.

Today the Media bin has **Text / Stickers / Captions** tabs that say “later.” Chat can call `add_captions`, `set_hook_title`, and `set_end_card`, but:

- Overlays have **no position, size, or style** — only `kind`, `text`, `from`, `durationInFrames`.
- Hook / end card are **singletons**. You cannot add a second title.
- `lower_third` exists in the schema and is unused in the bin.
- There is **no sticker** kind. No first-party graphics pack.
- The operator cannot type a title in the bin and drop it on the lane.

That is a hole in ADR-0016 and in “brand” for ADR-0049 (type on the ad, not only a logo bug).

## Vocabulary

| Term | Means | Is not |
|---|---|---|
| **Text overlay** | On-screen type the founder or agent *writes*: title, hook, lower third, CTA, free title. Lives on the overlay lane. | Captions (speech). Chat messages. |
| **Caption** | Timed lines that follow speech (or a typed stand-in). Lives on the **caption** lane. Many allowed. | A hook title. Asset-intelligence image captions (ADR-0032). |
| **Sticker** | A graphic with alpha (badge, arrow, circle, emoji-like mark) placed as an overlay, not a main-track clip. | B-roll. Logo Path C chrome (that stays brand kit). |
| **Library item** | A reusable sticker / text preset / caption style, first-party or product-owned. See ADR-0059. | A Studio Project. A marketplace billing SKU. |

Filters and Effects (grades / treatments) are **ADR-0058**, not this file.

Do not confuse **Text overlay / Sticker** (`overlays[]` on the overlay or caption lane) with glossary **Overlay** (second picture layer / PiP, ADR-0046). Same English word, different objects.

## Decision

### 1. One pipeline, two front-ends (unchanged)

Every apply is a **Studio mutation + tool**. Drag from the bin, inspector edits, and agent tool calls all hit `applyProjectMutation`. The agent sees human overlay edits next turn (ADR-0016).

### 2. Overlays grow layout + style; stickers get `assetId`

`overlay.kind` becomes:

`hook_title` | `end_card` | `lower_third` | `title` | `caption` | `sticker`

New fields (all optional except where noted):

- `layout`: `{ x, y, width, height, rotation }` in **0–1 of the frame** (not pixels). Defaults per kind (hook = top third, caption = bottom band, sticker = 0.7,0.7,0.22,0.22).
- `style`: `{ presetId, align, fontSizeEm, fill, stroke }` — missing fill/font **inherit Brand kit**.
- `assetId`: required for `sticker`; forbidden for text kinds.
- `libraryItemId`: optional pointer to the preset that created it.

`title` is **many**. `hook_title` and `end_card` stay **one each** (upsert). `caption` stays many. `sticker` is many.

Claim scan (ADR-0042) continues to read `overlay.text`. Sticker `assetId` is scanned by visual compliance when Analyze runs (ADR-0053), not by string lint.

### 3. Text tab — founder can add type without chat

Bin lists **text presets** (first-party + brand): Hook, Lower third, Title, CTA bar. Click or drag onto the overlay lane at the playhead (default 3s, hook 3s at 0, CTA last 3s).

Inspector (select overlay): edit copy, duration, layout (drag on player, same spirit as PiP), preset. Empty text is invalid (existing rule).

Tools: `add_text` (kind + text + optional timing/layout), `update_overlay`, existing `set_hook_title` / `set_end_card` / `remove_overlay`. Agent **must** use these; it must not `generate_image` of words as a substitute for a text overlay (same rule as ADR-0055: do not fake the artefact).

### 4. Captions tab — founder can add and restyle speech lines

Two entry points:

1. **From transcript** — `captions_from_transcript` builds caption overlays from word timings when a clip has a transcript. Confirm spend if transcription is missing and £>0.
2. **Type a line** — same as `add_captions` today, placed at playhead.

Caption **styles** are presets (static band, two-line, word-highlight). v1 is still Remotion `CaptionBand` (or a small family of bands). **Amended by [ADR-0075](./0075-word-timed-captions.md):** karaoke / word-timed presets, auto keyword highlights, and licensed auto emoji are **in scope now** (still data on the overlay, not a new editor product).

Captions stay on the caption lane (already distinct from overlay lane). Founder can trim/drag like Phase 2a overlays.

### 5. Stickers tab — first-party pack + place

Ship a **first-party sticker pack** in-repo (arrows, circles, check, “new”, brand-safe marks). No celebrity likeness, no random emoji font we do not license.

Place = create `overlay.kind = sticker` with `assetId` pointing at the pack blob (copied into project assets like brand kit stills). Drag to overlay lane; resize on player.

Do **not** put stickers on MAIN video as full-frame clips. That would fail picture completeness (stills-as-ad). Stickers are overlays, like logo chrome, and must not cover the readable picture (cut review `size` check still applies).

### 6. Remotion

Talking-head (and slideshow when the overlay is in range) renders text overlays with brand type, stickers as `<Img>` with alpha, captions as now. Path C logo stays **above** stickers and grades (ADR-0006 / 0045). Stickers must not hide the logo.

### 7. UX-first

- Applying a preset is a **visible overlay on the player**, not a disabled bin button.
- `captions_from_transcript` and sticker **generate** (ADR-0059) use the existing job banner / modal pattern.
- Status is not only a chip on the tab.

## Rejected

- Free HTML/CSS in overlay JSON (XSS + non-deterministic render).
- A second captions product (SRT export-only, burned-in vs sidecar). v1 **burns in** on the Remotion export. Sidecar SRT may come later as an export option, not a second timeline.
- Treating Path C logo as a sticker the founder deletes from Stickers. Logo stays Brand Studio.
- Particle sticker systems / Lottie as v1 (SVG/PNG/WebP only).

## Consequences

- Schema migration for overlay fields; old overlays keep defaults.
- Media bin stubs in `AssetBin` go away for these three tabs.
- Plan 27 / epic children implement this contract.
