# Overlay bin (Text, Captions, Stickers, Filters, Effects)

Operator-facing contract for Media bin tabs in ADR-0016. Architecture: [overlay-library.md](../architecture/overlay-library.md).

## What the operator sees

Each tab is a **library of things you drop on the cut**, not a settings page.

1. **Text** — Hook, Lower third, Title, CTA. Drag to the overlay lane or click to place at the playhead. Player shows the type immediately. Inspector: copy, length, position (drag on the player).
2. **Captions** — “From this clip’s transcript” (banner while transcribe/caption jobs run) and “Type a line.” Caption lane updates; style chips (band / karaoke / highlights / emoji — [ADR-0075](../adr/0075-word-timed-captions.md)).
3. **Stickers** — Grid of first-party marks + product library. Drag onto picture. Generate and Import sit in the tab, not buried in chat.
4. **Filters** — Looks (VHS, teal, perfume, library). Label: **Apply to cut** vs **Apply to selected clip**. Intensity slider. Do not hide this on a disabled Effects button.
5. **Effects** — Shake, glow, flash, zoom-punch. Applies to the selected clip (or clip under playhead). Empty state if nothing is selected: “Select a clip on the timeline.”

## Agent

Chat can do every action via tools. The bin must still work with chat closed. After an agent place, the overlay/clip is selected so the operator sees it.

## Async

Generate sticker / transcribe-for-captions: **modal on start** (minimize) + **persistent banner**. Reload polls jobs. Do not leave status on the Generate button label.

## Empty states

- No brand: Text still works with defaults; copy says “Brand Studio sets type and color.”
- No transcript: Captions offer type-a-line; From-transcript explains the spend confirm.
- No clip selected: Filters default to whole cut; Effects ask to select a clip.
