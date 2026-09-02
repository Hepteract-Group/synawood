# ADR-0072 — Chat grounding beyond `@asset:`

**Status:** accepted  
**Date:** 2026-08-23  
**Wave:** Vision **2L** · Epic [#866](https://github.com/Hepteract-Group/marketing-os/issues/866)  
**Amends:** [ADR-0015](./0015-asset-recall-and-reference.md) (reference tokens were assets only)  
**Related:** [ADR-0001](./0001-studio-agent-harness.md), [ADR-0016](./0016-studio-editor-chrome.md), [ADR-0019](./0019-studio-chat-narration-and-receipts.md)

## Context

OpusClip AI Producer chat accepts `@00:12` plus a selected region (“select area swap the B-roll”). Studio chat only inserts `@asset:…`. Operators say “that clip,” “this title,” “here.” The agent guesses `assets[0]`. That is the same identification failure ADR-0015 fixed for library tiles.

## Decision

### 1. Typed tokens in the composer

Extend ADR-0015 tokens. The chat route resolves them server-side and injects structured context for the turn:

| Token | Resolves to |
|---|---|
| `@asset:…` | Existing. Asset id + probe. |
| `@t:00:12` / `@t:12.4` | Playhead time on the current Studio Project (seconds). |
| `@clip:c_12` | Timeline clip (not only the library asset). |
| `@overlay:ov_3` | Overlay or caption id. |
| `@region:` | Normalized box `{ x, y, width, height }` 0–1 of the frame at `@t` (optional). |

The composer may insert tokens from: playhead button, selected clip/overlay, transcript caret, or a draw-on-player region. Operators can also type `@t:`.

### 2. Selection is implicit context

If the operator has a clip, overlay, or transcript span selected **and** sends a message with no token, the turn still includes that selection as `grounding` (same payload as a token). Tokens win when both exist.

### 3. Tools stay the vocabulary

Grounding does not add “do whatever to the selection.” The agent still calls `trim_clip`, `remove_clip`, `update_overlay`, `assemble_broll`, etc. Grounding only names **what** and **when**.

### 4. UX-first

Tokens render as chips in the composer (readable time / clip name), not raw ids. Missing resolution → one sentence in the composer (“Clip was removed”) — not a silent drop. No extra modal for inserting `@t:` from the playhead; one click.

## Consequences

- Chat API accepts `grounding` on the turn body even when the markdown has no `@`.
- Player region draw is optional v1; `@t:` + `@clip:` ship first if region is slow.
- Screenshot-to-chat stays Later ([competitive](../competitive/editor-agents.md)).

## Rejected

- A second slash-command language (stat card, quote callout). Overlay presets + marketing skills cover that.
- Shipping blob keys in the composer beyond signed URLs already exposed.
