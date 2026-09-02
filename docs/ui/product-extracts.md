# Product Extracts (UI)

Visual spec. Behaviour: [ux/product-extracts.md](../ux/product-extracts.md). Layout: [studio-layout.md](./studio-layout.md). Tokens: [tokens.md](./tokens.md). Async chrome: render/extract modal + `workspace-status-stack` banner.

## Media tab modes

Under Media bin → **Media**, a three-mode switch: **Library | Story | Extracts**. Same control size as Story. Do not nest Extracts under a overflow menu.

## Extracts grid

- Thumbnails in the existing asset grid density.
- Caption: host + path truncated; full URL on the detail.
- Score chip on the thumb: **usable** (default), **weak** (warning), **reject** (danger). Chip + word, not colour alone.
- **Delete** control on each card (trash, always visible — not hover-only). Confirm still required.
- Rejected: 50% opacity **plus** the chip. Still clickable.

## Detail

Click → existing asset inspector pattern. Fields: still, source URL (text, copyable), score, quality note. Actions: **Place on cut** (primary), **Delete** (also on the card; confirm: removes from this Product for every Studio project).

Do not open a second Studio column. Inspector stays in the bin / overlay used for Library assets.

## Extract run

Reuse extract/render **dialog-root**. Title: **Extracting pages…**. Minimize → banner: **Extracting pages** with count when known (`3 of 8`). Complete → banner dismisses; Extracts mode should be selected if the operator started extract from this tab.

Spend confirm (plan extra URLs): same confirm-spend modal as generate ([billing.md](./billing.md)).
