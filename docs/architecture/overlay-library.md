# Overlay library (Text, Captions, Stickers, Filters, Effects)

Contract: [ADR-0057](../adr/0057-overlay-library-text-captions-stickers.md), [ADR-0058](../adr/0058-filters-and-treatments.md), [ADR-0059](../adr/0059-authorable-library-import.md).  
Epic: [#692](https://github.com/Hepteract-Group/marketing-os/issues/692). UX: [overlay-bin.md](../ux/overlay-bin.md).

## Why

Media bin tabs from ADR-0016 were empty except Effects looks. Operators and the Studio Agent both need to put type and graphics on the timeline, grade a clip or the cut, and punch a treatment — without a freelance motion designer.

## Map

| Tab | ADR | Apply target | Create / import |
|---|---|---|---|
| Text | 0057 | Overlay lane | Presets; type in inspector |
| Captions | 0057 | Caption lane | From transcript or type |
| Stickers | 0057 | Overlay (alpha graphic) | First-party pack; generate; PNG/WebP/SVG |
| Filters | 0058 | Cut (`stylePackId`) or clip (`filterId`) | Pack JSON; save sliders; `.cube` LUT (#720) |
| Effects | 0058 | Clip treatments | Primitive stack; save stack |

All applies are Studio Tools + mutations (ADR-0001 / 0016).

## Schema (target)

- `overlays[]` — layout, style, `title` / `sticker` kinds, sticker `assetId`
- `clips[]` — `filterId`, `filterIntensity`, `treatments[]`
- `studio_library_items` — product-scoped authored/imported items

## Tools (target)

`add_text`, `update_overlay`, `add_captions`, `captions_from_transcript`, `set_caption_style`, `place_sticker`, `apply_filter`, `apply_effect`, `list_library`, `create_library_item`, `import_library_item`, plus existing hook/end card/remove.

Wave **2L** karaoke / highlight / emoji: [ADR-0075](../adr/0075-word-timed-captions.md), [editor-agent-polish.md](./editor-agent-polish.md).

## Guardrails

- Brand type and Path C logo win over grades and stickers.
- Unknown ids fail Approve.
- Imported items need a commercial-use check.
- No CapCut/AE **project file** import. No agent-written GLSL shaders.
- Licensed Lottie (Product library) and agent-authored **Composition source** are Wave **2M** ([ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)), not this overlay-item path.
