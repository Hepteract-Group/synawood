# Artefacts pane (UI)

Visual spec. Behaviour: [ux/artefacts.md](../ux/artefacts.md). Layout: [studio-layout.md](./studio-layout.md).

## Place

**Left region**, extra tab or sub-rail on the media bin: **Media | … | Artefacts**. Swaps bin content only — never Player or Chat (ADR-0016).

Collapsed: restore rail **Artefacts** next to Media / Chat / Timeline.

Tree (not a Finder chrome clone):

```
Plan
  Generation plan    draft|ready|applied
Skills
  talking-head       (read-only)
  infographic-clarity
Brand
  kit excerpts       (read-only)
```

Row height ~32px. Selected row opens plan modal or a read-only markdown sheet (sanitised). No folder create. No drag of `.js`.

Skills markdown: existing Settings typography; `pre` wrap; no `dangerouslySetInnerHTML` of raw skill HTML.

Width: same as media bin. Do not steal chat width.
