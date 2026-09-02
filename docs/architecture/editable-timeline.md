# Editable timeline — direct manipulation + agent co-editing

> Epic issue tracks this. Contract for the CapCut-style timeline. Supersedes the "chat-first, read-only timeline" assumption in ADR-0001 for the editing surface; the agent remains the primary editor.

## Why

The read-only timeline made a single wrong edit unrecoverable without starting over. `@asset:… add this to the end` stacked at `from: 0` (agent mock hardcodes `from: 0`) — and there was no way to nudge it. Practical editing needs direct manipulation **alongside** the agent, not instead of it.

## Core principle: one pipeline, two front-ends

There is **one** `StudioProject`, **one** optimistic-concurrency flow (`expectedRevision`), and **one** tool vocabulary. Manual edits are just tool calls the timeline UI fires directly — they persist through the same `applyProjectMutation` path as agent calls. The agent reads the resulting project on its next turn, so it always sees human edits. Nothing is a parallel state.

```
Timeline drag/trim/split ─┐
                          ├─→ Studio Tool (pure fn) → saveProject(expectedRevision) → project
Chat agent tool call   ──┘
```

## Concurrency model: soft lock (decided)

- During an agent turn (`chatPending`), the timeline shows an **"agent is editing…"** state and is read-only; manual edits queue and apply when the turn completes.
- Manual edits between turns go through the same `expectedRevision` flow; a conflict surfaces the standard "reload" path, never silent divergence.
- Real-time tracking: tool-trace already streams each agent mutation; the timeline re-renders on each `project` SSE event so the founder watches the agent's edits land live.

## Edit operations (full set — decided)

All map to existing or new pure functions in `core/creative/project/operations.ts`:

| Gesture | Operation | Status |
|---|---|---|
| Drag clip horizontally | `placeClip(from)` | exists (auto-fit) |
| Drag clip edge | `trimClip(durationInFrames, trimStartFrames)` | exists (auto-fit) |
| Split clip at playhead | `splitClip(clipId, atFrame)` → two clips | **new** |
| Delete clip / overlay | `removeClip` / `removeOverlay` | exists / **new** |
| Ripple delete (close gap) | `rippleDeleteClip(clipId)` | **new** |
| Drag asset from library onto timeline at drop point | `addClip(from = dropFrame)` | exists |
| Snap to clip edges / playhead | UI-only (snap threshold px) | **new** |
| Zoom (frames-per-pixel) | UI-only state | **new** |
| Keyboard: `S` split, `Del` delete, `←/→` nudge | UI-only → above ops | **new** |

`removeOverlay` is the only missing primitive today (overlays are upsert-only); add it symmetric to `removeClip`.

## Multi-track (decided — phased)

The schema already carries `tracks[]` (id, type, order) and `clips[].trackId`; today only `track_video` is used for clips. Multi-track is therefore **additive**:

- **Phase 2a — overlay/caption lanes as draggable strips.** Overlays already have `from`/`durationInFrames`; render them on **separate** caption vs overlay lanes and allow drag/trim via `place_overlay`. No composition change. (Shipped — #48.)
- **Phase 2b — true B-roll / PiP video lane.** Add a second video track; composition gains a PiP prop (inset position/scale) and renders both video tracks. This is the ADR-0015-deferred merge; it gets its own focused PR and composition props. **Not required for Phase 1 to be useful.**

## Phase gate

**Status (2026-08-02):**

| Phase | Status | Tracker |
|---|---|---|
| Phase 1 — single-track direct manipulation + soft-lock + placement + library DnD | **Shipped** | Epic [#42](https://github.com/Hepteract-Group/marketing-os/issues/42) (closed) |
| Phase 2a — overlay/caption lanes | **Shipped** | [#48](https://github.com/Hepteract-Group/marketing-os/issues/48) |
| Phase 2b — B-roll / PiP video track + composition | **Shipped** | [#49](https://github.com/Hepteract-Group/marketing-os/issues/49) / [ADR-0046](../adr/0046-broll-pip-track.md) |

- **Phase 1 (shipped):** single-video-track direct manipulation (drag/trim/split/delete/ripple), library drag-on, snap/zoom/keyboard, soft-lock, **plus the agent-placement fix** (parse "at the end / at Ns / replace" → correct `from`). This alone makes the product practical.
- **Phase 2 (follow-on):** overlay lanes (2a shipped), then B-roll/PiP (2b — **#49**). Phase 1 never blocks on PiP.

## Agent-placement fix (bundled — the overlap bug)

The mock reasoner (and the real model via the system prompt) must resolve placement intent:
- "at the end / after / extend / append" → `from: lastClipEnd`
- "at Ns / at N frames" → explicit `from`
- "replace [the] clip" → `removeClip(sameId)` + `addClip(from: sameFrom)`
The `@asset:` resolver already fixes *which* asset; this fixes *where* it lands. Add a shared `resolvePlacementIntent` helper the mock and the prompt both describe.

## Guardrails

- Every manual edit is a tool call → recorded in tool trace, visible to the agent, covered by the same tests.
- No client-side-only timeline state that isn't derived from `StudioProject` (playhead/zoom/selection excepted).
- Optimistic UI updates may render instantly but must reconcile with the saved `project` on response; on conflict, reload (existing pattern).
- **Undo/redo** is revision-history-backed (`studio_project_revisions` + `history_tip`). Undo/redo move the cursor within stored snapshots; a new edit truncates any redo branch. Not an ad-hoc client stack (ADR-0016).

## Timeline chrome regions (ADR-0016 shell)

The timeline is the full-width bottom region of the editor shell, not a panel inside the right column:

- **Toolbar (left of ruler):** select, split, select-left, select-right, undo/redo (`⌘Z` / `⌘⇧Z`).
- **Track headers (left of lanes):** rendered from real `project.tracks[]` — lock / hide / mute per track, cover affordance, lane height / waveform size controls.
- **Transport:** shared playhead/transport state between Player and Timeline (timecode, play/pause, zoom/fit, fullscreen live in the Player pane's transport row; timeline zoom in the toolbar).
- **Audio lane:** waveform rendering for audio assets; voiceover entry point (generate/import) lives in the track header area.
- **Multi-lane:** video lane(s), overlay/caption lanes (Phase 2a), audio lane — each with headers per above.

## Out of scope (first pass)

- Transitions/crossfades, speed ramps, keyframed motion (Remotion composition features, separate ADRs).
- Multi-user collaborative editing.
- Drag-on *between* video tracks (2b only).
