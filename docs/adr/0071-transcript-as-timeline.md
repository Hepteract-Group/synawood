# ADR-0071 — Transcript as a cut surface

**Status:** accepted  
**Date:** 2026-08-23  
**Wave:** Vision **2L** · Epic [#866](https://github.com/Hepteract-Group/marketing-os/issues/866)  
**Related:** [ADR-0003](./0003-project-json-source-of-truth.md), [ADR-0016](./0016-studio-editor-chrome.md), [ADR-0033](./0033-voice-studio.md) (`remove_fillers` / `apply_cut_list`), [ADR-0057](./0057-overlay-library-text-captions-stickers.md)  
**Does not supersede:** Timeline remains source of truth. Transcript is a **view + mutation front-end**, not a second project document.

## Context

OpusClip and Descript let you cut talking-head video by editing the script. Studio can caption from a transcript and ripple-delete filler ranges. Deleting words in the script does **not** cut picture. Marketing-team takes have rambling, dead air, and retakes. That is the highest-leverage talking-head edit we lack.

## Decision

### 1. One cut list, four reasons

Generalize `remove_fillers` + `apply_cut_list` so a cut list is `{ startMs, endMs, reason }[]` with `reason`:

| Reason | Means |
|---|---|
| `filler` | um / uh / you know (existing) |
| `pause` | Dead air longer than a threshold (default 0.6s; keep a breath) |
| `retake` | False start / repeated take; keep the last complete take |
| `clarity` | Off-topic or rambling span the agent (or operator) marked |

`apply_cut_list` ripple-deletes those ranges on the A-roll (and linked captions/overlays in the window). Same mutation pipeline as the timeline.

### 2. Transcript pane is a first-class surface

Studio shows a **Transcript** pane for clips that have word timings. Selecting a span offers Split / Trim / Delete (ripple). Chat can pass the same ranges. The timeline playhead follows the caret; the caret follows the playhead.

No transcript → offer transcribe (existing spend confirm). Do not invent words.

### 3. Agent tools

| Tool | Purpose |
|---|---|
| `build_cut_list` | Propose ranges for one or more reasons. Dry-run default true. |
| `apply_cut_list` | Commit (existing; accept the new reasons). |
| `edit_for_clarity` | Agent-only wrapper: propose `clarity` ranges from the script + brief. Operator confirms if £>0 or >N seconds removed. |

Filler / pause / retake may run without a chat essay. Clarity that removes >15% of duration needs a visible confirm (modal), not a silent tool.

### 4. UX-first

Applying a cut is **picture changing on the player**, not a disabled script button. Long jobs (transcribe, clarity pass): **modal on start** (minimize) + **persistent banner**. Reload polls server jobs. Status is not a chip on the transcript tab.

## Consequences

- Word timings must exist on talking-head clips before this pane is useful (transcription generator).
- Jump-cut hide (zooms) is a **policy** on these cuts ([ADR-0073](./0073-talking-head-first-pass.md)), not a second cut product.
- Chapters stay vetoed. This is 30–120s ads, not a podcast TOC.

## Rejected

- Transcript as a second source of truth that can drift from project JSON.
- Rewrite-what-was-said (Descript regenerate). Healing a jump cut ≠ changing the line ([competitive veto](../competitive/editor-agents.md)).
- Auto-censor / bleep as a SKU.
