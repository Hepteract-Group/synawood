# Studio editor chrome — dual front-end (chat + CapCut-style workspace)

Studio ships as a **full-viewport editor** with two equal front-ends over one pipeline: the chat agent (ADR-0001) **and** direct-manipulation chrome modeled on the founder sketch (`docs/ui/assets/studio-sketch-2026-07-19.jpg`). Drag-and-drop and manual timeline editing are **in**; the old "chat-first panel, read-only timeline" layout is out.

**Why:** The chat-left, everything-stacked-right layout made Studio a chatbot with a preview attached. Founders think in the timeline: they drag footage in, scrub, split, nudge. `docs/architecture/editable-timeline.md` already decided the *editing contract* (one pipeline, two front-ends); this ADR decides the *workspace shape* that contract lives in. Without the shell change, every editable-timeline feature lands in a layout that fights it.

## Decision

1. **Full-viewport editor route.** `/studio/{projectId}` escapes the constrained dashboard content shell: app sidebar collapses, the editor owns the viewport.
2. **Three resizable panes over a full-width timeline:**
   - **Left — Media bin.** First-class asset area with top tabs (Media / Audio / Text / Stickers / Effects / Captions / Filters). Tabs swap the bin's content only. Media tab is a drag-drop upload zone. Text / Stickers / Captions / Filters / Effects contents are Wave **2K** ([ADR-0057](./0057-overlay-library-text-captions-stickers.md), [ADR-0058](./0058-filters-and-treatments.md), [ADR-0059](./0059-authorable-library-import.md)) — not permanent empty states.
   - **Center — Player + transport.** Remotion Player, timecode, play, zoom/fit, fullscreen, quality stub.
   - **Right — Chat.** The Studio Agent conversation and composer. Chat no longer owns the left rail. Tool traces render on the **Usage** surface, not in chat (founder call — chat stays edit-only).
   - **Bottom — Timeline chrome.** Full-width: toolbar (select / split / select-left / select-right), track headers (lock / hide / mute), multi-lane tracks, audio waveform lane, voiceover entry, cover, zoom.
3. **Direct manipulation is a first-class input.** Dragging an asset from the bin onto the timeline at a drop frame, drag/trim/split/delete on clips — all fire Studio Tool calls through the same `applyProjectMutation` path as agent calls (editable-timeline contract). DnD is no longer deferred.
4. **Review/spend chrome compacts.** Reasoner / Image / Video model dropdowns sit beside chat Send; brand chip stays in the workspace header; SessionSpend into the chat footer; the ReviewBar becomes a compact pill directly under the Player (founder-approved — review sits next to what it commits). None compete with the Player as stacked panels. Tool traces move out of Studio entirely, onto Usage.

## Supersedes / clarifies

- **ADR-0015** — the "Drag-and-drop onto the timeline … deferred; chat-first remains the primary edit path" clause is superseded. Recall ("Place on timeline") and `@asset:` reference remain; DnD joins them as a third recall path.
- **ADR-0001** — the agent harness is unchanged and remains the primary *editor* (it does the complex, multi-step cuts). The timeline is now a co-equal *input* surface, per the editable-timeline doc's "one pipeline, two front-ends".
- **ADR-0004** — clarified: adopting CapCut-**style chrome** is not building a CapCut **clone**. Chrome is the unlock for founder-speed editing. **Amended by [ADR-0091](./0091-empowered-agent-authored-compositions.md):** do not use “feature count” or “we’d look like CapCut” to refuse transitions, keyframes, Lottie, or agent-authored Remotion. This epic still did not ship those; Wave **2M** does.

## Phasing (tracked in Epic #53)

- **Phase 1 — shell IA:** full-viewport layout, three panes with splitters, tabbed Media bin, collapsible nav, compacted review/spend chrome. Existing features rehomed, not redesigned.
- **Phase 2 — editable timeline Phase 1 on the new shell:** playhead/transport sync, drag/trim/split/delete/ripple, library DnD at drop frame, soft-lock during agent turns (Epic #42).
- **Phase 3 — track + audio chrome:** track headers (lock/hide/mute), audio lanes with waveforms, voiceover entry, cover, select-left/right, then undo/redo.
- **Phase 4:** Plans 03–05 UI slices (generators, slideshow) resume *into* the new shell.

## Guardrails

- Pane sizes and sidebar collapse persist in `localStorage`; no server state for layout.
- Undo/redo decided before coding: revision-history-backed stack, not ad-hoc client state (see editable-timeline out-of-scope note; this epic closes it).
- Every manual gesture remains a recorded tool call — the agent sees human edits next turn.
- No new paid model spend is enabled by this ADR.
