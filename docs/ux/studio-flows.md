# Studio flows

## Flow A — Weekly team cut (primary v1)

Trial default is this flow **without** paid hosted video ([ADR-0083](../adr/0083-trial-path-to-first-approve.md)). Empty Studio: upload a take, not generate a film.

1. Open Studio from this week's Draft pack slot.
2. Attach raw take (upload) or select existing asset.
3. Agent proposes cut: talking-head first pass when it is a take ([ADR-0073](../adr/0073-talking-head-first-pass.md)) — enhance, cut list, captions, duck, brand, critic — or the operator asks in chat.
4. Preview in player; iterate via chat and transcript pane (“tighter hook”, “cut first 2s”, delete a span in the script).
5. Export → wait for Render Job → review candidate (optional thumbnail — [approval-thumbnail.md](./approval-thumbnail.md)).
6. Approve → Final asset in pipeline; or Kill / Regenerate.

## Flow B — Product / infographic short (generative)

1. Start from Brief (channel, length, angle).
2. Agent may `generate_image` (infographic/conceptual stills) and/or `generate_voiceover`; prefer Brand kit stills for real product UI.
3. Place assets on `product_infographic` (or talking-head) composition; captions + end card.
4. Same preview → Remotion export → Approve path as Flow A.

## Flow B2 — Synthetic short (little/no footage)

1. Brief → agent drafts a **Generation Plan** (scenes, dialogue, models, £) when paid generate is on ([generation-plan.md](./generation-plan.md)).
2. Operator confirms spend; then `generate_video_clip` and/or image sequence + TTS.
3. Wait on Generation Jobs; attach clips; assemble in Remotion (hook, captions, CTA).
4. Export → Approve. Raw generator MP4 is never the Final asset by itself.

## Flow C — Resume

1. Open existing Studio Project from pipeline card.
2. Chat continues with project summary injected; no “start over” unless asked.

## Flow E — Recall and rework (asset library as working set)

Per [ADR-0015](../adr/0015-asset-recall-and-reference.md). The Asset Library is not read-only — any asset can return to the timeline or anchor a chat instruction.

1. **Recall without chat:** asset tile → “Place on timeline” → deterministic `add_clip` at `lastClipEnd` with the asset's natural duration. No model tokens spent.
2. **Reference in chat:** asset tile → “Reference in chat” → composer gets a typed `@asset:name` token. The agent resolves it to the real asset id and grounds edits on it:
   - “replace the clip with @asset:new-take.mp4”
   - “insert @asset:b-roll.mp4 at 12s”
   - “extend with @asset:part2.mp4”
3. **Drag onto the timeline:** per ADR-0016, dragging an asset from the Media bin onto the timeline places it at the drop frame (`addClip(from = dropFrame)`) — a third recall path alongside "Place on timeline" and `@asset:` reference. Same mutation path, no chat turn.
4. Iterate as Flow A: preview → refine → export.

Non-goals for this flow: multi-track merge/PiP (separate composition work), cross-project recall.

## Flow D — Slideshow / carousel

See [slideshow-flow.md](./slideshow-flow.md) — Instagram/TikTok-style slide packs with optional VO and dual still/MP4 export.

## Flow F — Ad Generator (URL/PDF → variants)

See [ad-generator-flow.md](./ad-generator-flow.md) — extract brief, apply first cut, fan out platform × hook × CTA child projects (ADR-0027).

## Flow G — Transcript cut

See [transcript-cut.md](./transcript-cut.md) — select words, ripple-delete, agent cut lists (ADR-0071).

## Flow H — Chat grounding

See [chat-grounding.md](./chat-grounding.md) — `@t:` / selected clip in the composer (ADR-0072).

## Flow I — Motion-graphics / authored composition

See [authored-composition-flow.md](./authored-composition-flow.md).

1. Operator picks **Motion ad** on Create Project (or Craft → Motion graphics in chat). They describe the ad. No magic word “kinetic”.
2. Agent writes Composition source (`write_composition`); Player shows the compiled iframe. Compile failure: banner under the player.
3. Direct in chat (“harder spring”, “different glitter”). `inspect_preview` on make-ad turns.
4. Same Export → Render Job → Approve as Flow A.
