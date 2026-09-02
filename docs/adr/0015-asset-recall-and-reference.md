# Asset reuse: library-to-timeline recall and asset-referenced chat

Any asset on a Studio Project can be **recalled onto the timeline** and **referenced in chat** so the agent can act on it directly. The Asset Library is not a read-only graveyard; it is the working set for iterative editing.

**Amended by [ADR-0072](./0072-chat-grounding.md):** tokens also cover playhead time, timeline clip, overlay, and optional player region — not only library assets.

**Why:** Operators iterate in loops — pull last week's cut back in, swap a clip, insert new footage at 12s. Today the only path from asset to timeline is hoping the agent guesses the right `assetId` from `assets[0]` (the mock literally does this). Without first-class recall and reference, the library is write-only and the agent is blind to intent like "use *that* video."

## Decision

Two complementary mechanisms, one for the UI and one for the agent loop. Neither replaces the other.

### 1. Library-to-timeline recall (UI affordance)

Every asset tile in the Asset Library gets a **"Place on timeline"** action (alongside preview/remove). It calls the existing `add_clip` operation with sensible defaults (`from: lastClipEnd`, asset's natural duration). This is deterministic, offline-capable, and costs no model tokens — recall should not require a chat turn.

### 2. Asset-referenced chat (agent context)

Asset tiles are **referenceable in chat**: a "Reference in chat" affordance inserts a typed token (e.g. `@asset:clip-12s.mp4`) into the composer. The chat route resolves tokens to `{ assetId, kind, source, probe }` and includes them in the turn context so the agent can ground operations on the right asset:

- "replace the clip with @asset:new-take.mp4" → `remove_clip` + `add_clip` at the same `from`
- "insert @asset:b-roll.mp4 at 12s" → `add_clip` with explicit `from`
- "extend with @asset:part2.mp4" → `add_clip` at `lastClipEnd`

The agent's edit vocabulary stays the same (`add_clip`, `trim_clip`, `remove_clip`, `place_clip`); reference tokens only fix the *asset identification* problem, which is the actual failure mode.

## Explicitly out of scope (for now)

- **Multi-track merge / compositing.** "Merge with existing video" as picture-in-picture or A/B-roll crossfade is a Remotion composition feature, not a recall feature. When needed, it gets its own ADR and composition props.
- **Cross-project asset recall.** Pulling assets from *other* Studio Projects requires a product-level asset browser; deferred until the content pipeline needs it.
- ~~Drag-and-drop onto the timeline.~~ **Superseded by ADR-0016** — DnD is in scope as a third recall path (`addClip(from = dropFrame)`); chat and timeline are co-equal edit front-ends.

## Guardrails

- Recall and reference must respect optimistic concurrency (same `expectedRevision` flow as uploads).
- Reference tokens resolve server-side only; the composer never ships blob keys to the client beyond what signed URLs already expose.
- `add_clip` validation (asset exists on project, placement within duration) stays the single source of truth — UI recall and agent reference both go through it.
