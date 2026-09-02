---
name: editor-cuts
description: Pacing, silence removal, and jump-cut rules for timeline edits and contextual suggestions.
---

# Editor cuts

## Rules

- Close gaps between clips when the story should feel continuous (`pack_clips`).
- Trim trailing silence / dead air before generating new picture.
- Split long clips at a beat change only when both halves have a purpose.
- Prefer ripple-aware deletes when removing a beat from the middle.

## Tool hints

- `pack_clips` for "close the gap" / "merge clips".
- `trim_clip` for shorten / tighten.
- `split_clip` when a mid-clip beat change is explicit.
- Do not invent frame numbers - read `projectSummary` / clip `from` + `durationInFrames`.
